import { computeCollateralizationRatio, decToScale, scaleToDec, WAD, wadToDec, ZERO } from '@fiatdao/sdk';
import { Button, Card, Grid, Input, Loading, Modal, Row, Spacer, Switch, Text } from '@nextui-org/react';
import { BigNumber, ethers } from 'ethers';
import React, { useMemo } from 'react';
import shallow from 'zustand/shallow';
import { useLeverStore } from '../../state/stores/leverStore';
import { commifyToDecimalPlaces, floor2, floor4 } from '../../utils';
import { Alert } from '../Alert';
import { InputLabelWithMax } from '../InputLabelWithMax';
import useStore from '../../state/stores/globalStore';
import { NumericInput } from '../NumericInput/NumericInput';
import { RadixSlider } from '../RadixSlider/RadixSlider';

export const LeverCreateForm = ({
  onClose,
  // TODO: refactor out into react query mutations / store actions
  createLeveredPosition,
  setUnderlierAllowanceForProxy,
  unsetUnderlierAllowanceForProxy,
}: {
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  createLeveredPosition: (upFrontUnderlier: BigNumber, addDebt: BigNumber, minUnderlierToBuy: BigNumber, minTokenToBuy: BigNumber) => any;
  setUnderlierAllowanceForProxy: (fiat: any, amount: BigNumber) => any,
  unsetUnderlierAllowanceForProxy: (fiat: any) => any,
}) => {
  const leverStore = useLeverStore(
    React.useCallback(
      (state) => ({
        createState: state.createState,
        createActions: state.createActions,
        formDataLoading: state.formDataLoading,
        formWarnings: state.formWarnings,
        formErrors: state.formErrors,
      }),
      []
    ), shallow
  );

  const fiat = useStore(state => state.fiat);
  const hasProxy = useStore(state => state.hasProxy);
  const disableActions = useStore((state) => state.disableActions);
  const transactionData = useStore((state => state.transactionData));
  const modifyPositionData = useStore((state) => state.modifyPositionData);
  const [submitError, setSubmitError] = React.useState('');

  const {
    collateralType: {
      metadata: { symbol: tokenSymbol },
      properties: { underlierScale, underlierSymbol, tokenScale }
    },
    underlierAllowance,
    underlierBalance,
    monetaDelegate,
  } = modifyPositionData;
  const {
    upFrontUnderliers, collateralSlippagePct, underlierSlippagePct, targetedCollRatio,
    addDebt, minUnderliersToBuy, minTokenToBuy, 
    collateral, collRatio, debt, minCollRatio, maxCollRatio
  } = leverStore.createState;
  const {
    setUpFrontUnderliers, setCollateralSlippagePct, setUnderlierSlippagePct, setTargetedCollRatio
  } = leverStore.createActions;
  const { action: currentTxAction } = transactionData;

  const upFrontUnderliersBN = useMemo(() => {
    return leverStore.createState.upFrontUnderliers === '' ? ZERO : decToScale(leverStore.createState.upFrontUnderliers, underlierScale)
  }, [leverStore.createState.upFrontUnderliers, underlierScale])

  const renderFormAlerts = () => {
    const formAlerts = [];

    if (!hasProxy) {
      formAlerts.push(
        <Alert
          severity='warning'
          message={'Creating positions requires a Proxy. Please close this modal and click "Create Proxy Account" in the top bar.'}
          key={'warn-needsProxy'}
        />
      );
    }

    if (leverStore.formWarnings.length !== 0) {
      leverStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (leverStore.formErrors.length !== 0) {
      leverStore.formErrors.forEach((formError, idx) => {
        formAlerts.push(<Alert severity='error' message={formError} key={`err-${idx}`} />);
      });
    }

    if (submitError !== '' && submitError !== 'ACTION_REJECTED' ) {
      formAlerts.push(<Alert severity='error' message={submitError} key={'error-submit'}/>);
    }

    return formAlerts;
  }

  if (
    !modifyPositionData.collateralType ||
    !modifyPositionData.collateralType.metadata
  ) {
    // TODO: add skeleton components instead of loading
    return null;
  }

  return (
    <>
      <Modal.Body>
        <Text b size={'m'}>Inputs</Text>
        {underlierBalance && (
          <Text size={'$sm'}>
            Wallet:{' '}
            {commifyToDecimalPlaces(underlierBalance, underlierScale, 2)}{' '}
            {underlierSymbol}
          </Text>
        )}
        <NumericInput
          disabled={disableActions}
          value={upFrontUnderliers.toString()}
          onChange={(event) => { setUpFrontUnderliers(fiat, event.target.value, modifyPositionData) }}
          placeholder='0'
          label={'Underlier to swap'}
          rightAdornment={underlierSymbol}
        />
        <Grid.Container
          gap={0}
          justify='space-between'
          css={{ marginBottom: '1rem' }}
        >
          <Grid>
            <NumericInput
              disabled={disableActions}
              value={underlierSlippagePct.toString()}
              onChange={(event) => { setUnderlierSlippagePct(fiat, event.target.value, modifyPositionData) }}
              step='0.01'
              placeholder='1.00'
              label='Slippage w/ Price Impact (FIAT to Underlier swap)'
              rightAdornment={'%'}
              style={{ width: '11.0rem' }}
            />
          </Grid>
          <Grid>
            <NumericInput
              disabled={disableActions}
              value={collateralSlippagePct.toString()}
              onChange={(event) => { setCollateralSlippagePct(fiat, event.target.value, modifyPositionData) }}
              step='0.01'
              placeholder='1.00'
              label='Slippage w/ Price Impact (Underlier to Collateral swap)'
              rightAdornment={'%'}
              style={{ width: '11.0rem' }}
            />
          </Grid>
        </Grid.Container>
        {(!minCollRatio.isZero() && !maxCollRatio.isZero() && !minCollRatio.eq(maxCollRatio)) && (
          <>
            <Text
              size={'0.75rem'}
              style={{ paddingLeft: '0.25rem', marginBottom: '0.375rem' }}
            >
              Targeted collateralization ratio ({floor2(wadToDec(targetedCollRatio.mul(100)))}%)
            </Text>
            <Card variant='bordered' borderWeight='light' style={{height:'100%'}}>
              <Card.Body
                style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem', overflow: 'hidden' }}
              >
                <RadixSlider
                  aria-label={'Targeted Collateralization Ratio'}
                  disabled={disableActions}
                  inverted
                  max={(maxCollRatio.eq(ethers.constants.MaxUint256)) ? 5.0 : floor4(wadToDec(maxCollRatio))}
                  maxLabel={'Safer'}
                  min={floor4(wadToDec(minCollRatio))}
                  minLabel={'Riskier'}
                  onChange={(value) => { setTargetedCollRatio(fiat, Number(value), modifyPositionData) }}
                  step={0.001}
                  value={[Number(wadToDec(targetedCollRatio))]}
                />
              </Card.Body>
            </Card>
          </>
        )}
        <Text size={'$sm'}>
          Note: The fees are due on the total leveraged amounts. Withdrawing collateral before maturity most likely will result in a loss.
        </Text>
      </Modal.Body>
      <Spacer y={0.75} />
      <Card.Divider />
      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>Leveraged Swap Preview</Text>
        <Input
          readOnly
          value={(leverStore.formDataLoading)
            ? ' '
            : `${floor2(scaleToDec(minTokenToBuy, tokenScale))}`
          }
          placeholder='0'
          type='string'
          label={'Total Collateral to deposit (incl. slippage)'}
          labelRight={tokenSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
      </Modal.Body>
      <Spacer y={0.75} />
      <Card.Divider />
      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>Position Preview</Text>
        <Input
          readOnly
          value={(leverStore.formDataLoading)
            ? ' '
            : `${floor2(wadToDec(collateral))}`
          }
          placeholder='0'
          type='string'
          label={'Collateral (incl. slippage)'}
          labelRight={tokenSymbol}
          contentLeft={(leverStore.formDataLoading) ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(leverStore.formDataLoading) ? ' ' : floor2(wadToDec(debt))}
          placeholder='0'
          type='string'
          label='Debt (incl. slippage)'
          labelRight={'FIAT'}
          contentLeft={(leverStore.formDataLoading) ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={
            (leverStore.formDataLoading)
              ? ' '
              : `${floor2(wadToDec(collRatio.mul(100)))}%`
          }
          placeholder='0'
          type='string'
          label='Collateralization Ratio (incl. slippage)'
          labelRight={'🚦'}
          contentLeft={(leverStore.formDataLoading) ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />

        {/* renderSummary() */}

      </Modal.Body>
      <Modal.Footer justify='space-evenly'>
        <Card variant='bordered'>
          <Card.Body>
          <Row justify='flex-start'>
            <Switch
              disabled={disableActions || !hasProxy}
              // Next UI Switch `checked` type is wrong, this is necessary
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              checked={() => underlierAllowance?.gt(0) && underlierAllowance?.gte(upFrontUnderliersBN) ?? false}
              onChange={async () => {
                if (!upFrontUnderliersBN.isZero() && underlierAllowance?.gte(upFrontUnderliersBN)) {
                  try {
                    setSubmitError('');
                    await unsetUnderlierAllowanceForProxy(fiat);
                  } catch (e: any) {
                    setSubmitError(e.message);
                  }
                } else {
                  try {
                    setSubmitError('');
                    await setUnderlierAllowanceForProxy(fiat, upFrontUnderliersBN);
                  } catch (e: any) {
                    setSubmitError(e.message);
                  }
                }
              }}
              color='primary'
              icon={
                ['setUnderlierAllowanceForProxy', 'unsetUnderlierAllowanceForProxy'].includes(currentTxAction || '') && disableActions ? (
                  <Loading size='xs' />
              ) : null
              }
            />
            <Spacer x={0.5} />
            <Text>Allow <code>FIAT I</code> to transfer your {underlierSymbol}</Text>
          </Row>
          </Card.Body>
        </Card>
        <Spacer y={0.5} />
        { renderFormAlerts() }
        <Button
          css={{ minWidth: '100%' }}
          disabled={
            leverStore.formErrors.length !== 0 ||
            leverStore.formWarnings.length !== 0 ||
            disableActions ||
            !hasProxy ||
            upFrontUnderliersBN?.isZero() ||
            minTokenToBuy?.isZero() ||
            underlierAllowance?.lt(upFrontUnderliersBN) ||
            monetaDelegate === false
          }
          icon={(disableActions && currentTxAction === 'createLeveredPosition') ? (<Loading size='xs' />) : null}
          onPress={async () => {
            try {
              setSubmitError('');
              await createLeveredPosition(upFrontUnderliersBN, addDebt, minUnderliersToBuy, minTokenToBuy);
              onClose();
            } catch (e: any) {
              setSubmitError(e.message);
            }
          }}
        >
          Deposit
        </Button>
      </Modal.Footer>
    </>
  );
}

export const LeverIncreaseForm = ({
  onClose,
  // TODO: refactor out into react query mutations / store actions
  buyCollateralAndIncreaseLever,
  setUnderlierAllowanceForProxy,
  unsetUnderlierAllowanceForProxy,
}: {
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  buyCollateralAndIncreaseLever: (upFrontUnderlier: BigNumber, addDebt: BigNumber, minUnderlierToBuy: BigNumber, minTokenToBuy: BigNumber) => any;
  setUnderlierAllowanceForProxy: (fiat: any, amount: BigNumber) => any,
  unsetUnderlierAllowanceForProxy: (fiat: any) => any,
}) => {
  const [submitError, setSubmitError] = React.useState('');
  const leverStore = useLeverStore(
    React.useCallback(
      (state) => ({
        increaseState: state.increaseState,
        increaseActions: state.increaseActions,
        formDataLoading: state.formDataLoading,
        formWarnings: state.formWarnings,
        formErrors: state.formErrors,
      }),
      []
    ), shallow
  );
  const fiat = useStore(state => state.fiat);
  const hasProxy = useStore(state => state.hasProxy);
  const disableActions = useStore((state) => state.disableActions);
  const transactionData = useStore((state => state.transactionData));
  const modifyPositionData = useStore((state) => state.modifyPositionData);

  const {
    collateralType: {
      metadata: { symbol: tokenSymbol },
      properties: { underlierScale, underlierSymbol, tokenScale },
      state: { codex: { virtualRate }, collybus: { fairPrice } }
    },
    underlierAllowance,
    underlierBalance,
    monetaDelegate,
    position
  } = modifyPositionData;
  const {
    upFrontUnderliers, collateralSlippagePct, underlierSlippagePct,
    addDebt, minUnderliersToBuy, minTokenToBuy, targetedCollRatio,
    collateral, collRatio, debt, minCollRatio, maxCollRatio
  } = leverStore.increaseState;
  const {
    setUpFrontUnderliers, setCollateralSlippagePct, setUnderlierSlippagePct, setTargetedCollRatio
  } = leverStore.increaseActions;
  const { action: currentTxAction } = transactionData;

  const upFrontUnderliersBN = useMemo(() => {
    return leverStore.increaseState.upFrontUnderliers === '' ? ZERO : decToScale(leverStore.increaseState.upFrontUnderliers, underlierScale)
  }, [leverStore.increaseState.upFrontUnderliers, underlierScale])
  
  const renderFormAlerts = () => {
    const formAlerts = [];

    if (leverStore.formWarnings.length !== 0) {
      leverStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (leverStore.formErrors.length !== 0) {
      leverStore.formErrors.forEach((formError, idx) => {
        formAlerts.push(<Alert severity='error' message={formError} key={`err-${idx}`} />);
      });
    }

    if (submitError !== '' && submitError !== 'ACTION_REJECTED') {
      formAlerts.push(<Alert severity='error' message={submitError} key={'error-submit'}/>);
    }

    return formAlerts;
  }

  return (
    <>
      <Modal.Body>
        <Text b size={'m'}>Inputs</Text>
        {underlierBalance && (
          <Text size={'$sm'}>
            Wallet: {commifyToDecimalPlaces(underlierBalance, underlierScale, 2)} {underlierSymbol}
          </Text>
        )}
        <NumericInput
          label={'Underlier to deposit'}
          disabled={disableActions}
          value={upFrontUnderliers.toString()}
          onChange={(event) => { setUpFrontUnderliers(fiat, event.target.value, modifyPositionData) }}
          placeholder='0'
          inputMode='decimal'
          rightAdornment={underlierSymbol}
        />
        <Grid.Container
          gap={0}
          justify='space-between'
          css={{ marginBottom: '1rem' }}
        >
          <Grid>
            <NumericInput
              disabled={disableActions}
              value={underlierSlippagePct.toString()}
              onChange={(event) => { setUnderlierSlippagePct(fiat, event.target.value, modifyPositionData) }}
              placeholder='1.00'
              label='Slippage (FIAT to Underlier swap)'
              rightAdornment={'%'}
              style={{ width: '11.0rem' }}
            />
          </Grid>
          <Grid>
            <NumericInput
              disabled={disableActions}
              value={collateralSlippagePct.toString()}
              onChange={(event) => { setCollateralSlippagePct(fiat, event.target.value, modifyPositionData) }}
              placeholder='1.00'
              label='Slippage (Underlier to Collateral swap)'
              rightAdornment={'%'}
              style={{ width: '11.0rem' }}
            />
          </Grid>
        </Grid.Container>
        {(!minCollRatio.isZero() && !maxCollRatio.isZero() && !minCollRatio.eq(maxCollRatio)) && (
          <>
            <Text
              size={'0.75rem'}
              style={{ paddingLeft: '0.25rem', marginBottom: '0.375rem' }}
            >
              Targeted collateralization ratio ({floor2(wadToDec(targetedCollRatio.mul(100)))}%)
            </Text>
            <Card variant='bordered' borderWeight='light' style={{height:'100%'}}>
              <Card.Body
                style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem', overflow: 'hidden' }}
              >
                <RadixSlider
                  aria-label={'Targeted Collateralization Ratio'}
                  disabled={disableActions}
                  inverted
                  max={(maxCollRatio.eq(ethers.constants.MaxUint256)) ? 5.0 : floor4(wadToDec(maxCollRatio))}
                  maxLabel={'Safer'}
                  min={floor4(wadToDec(minCollRatio))}
                  minLabel={'Riskier'}
                  onChange={(value) => {
                    setTargetedCollRatio(fiat, Number(value), modifyPositionData);
                  }}
                  step={0.001}
                  value={[Number(wadToDec(targetedCollRatio))]}
                />
              </Card.Body>
            </Card>
          </>
        )}
        <Text size={'$sm'}>
          Note: The fees are due on the total leveraged amounts. Withdrawing collateral before maturity most likely will result in a loss.
        </Text>
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>Leveraged Swap Preview</Text>
        <Input
          readOnly
          value={(leverStore.formDataLoading)
            ? ' '
            : `${floor2(scaleToDec(minTokenToBuy, tokenScale))}`
          }
          placeholder='0'
          type='string'
          label={'Total Collateral to deposit (incl. slippage)'}
          labelRight={tokenSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>Position Preview</Text>
        <Input
          readOnly
          value={(leverStore.formDataLoading)
            ? ' '
            : `${floor2(wadToDec(position.collateral))} → ${floor2(wadToDec(collateral))}`
          }
          placeholder='0'
          type='string'
          label={'Collateral (incl. slippage)'}
          labelRight={tokenSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(leverStore.formDataLoading)
            ? ' '
            : `${floor2(wadToDec(position.normalDebt.mul(virtualRate).div(WAD)))} → ${floor2(wadToDec(debt))}`
          }
          placeholder='0'
          type='string'
          label='Debt (incl. slippage)'
          labelRight={'FIAT'}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(() => {
            if (leverStore.formDataLoading) return ' ';
            let collRatioBefore = computeCollateralizationRatio(
              position.collateral, fairPrice, position.normalDebt, virtualRate
            );
            collRatioBefore = (collRatioBefore.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(collRatioBefore.mul(100)))}%`;
            const collRatioAfter = (collRatio.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(collRatio.mul(100)))}%`;
            return `${collRatioBefore} → ${collRatioAfter}`
          })()}
          placeholder='0'
          type='string'
          label='Collateralization Ratio (incl. slippage)'
          labelRight={'🚦'}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        {/* renderSummary() */}
      </Modal.Body>

      <Modal.Footer justify='space-evenly'>
        <Card variant='bordered'>
          <Card.Body>
          <Row justify='flex-start'>
            <Switch
              disabled={disableActions || !hasProxy}
              // Next UI Switch `checked` type is wrong, this is necessary
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              checked={() => underlierAllowance?.gt(0) && underlierAllowance?.gte(upFrontUnderliersBN) ?? false}
              onChange={async () => {
                if(!upFrontUnderliersBN.isZero() && underlierAllowance.gte(upFrontUnderliersBN)) {
                  try {
                    setSubmitError('');
                    await unsetUnderlierAllowanceForProxy(fiat);
                  } catch (e: any) {
                    setSubmitError(e.message);
                  }
                } else {
                  try {
                    setSubmitError('');
                    await setUnderlierAllowanceForProxy(fiat, upFrontUnderliersBN)
                  } catch (e: any) {
                    setSubmitError(e.message);
                  }
                }
              }}
              color='primary'
              icon={
                ['setUnderlierAllowanceForProxy', 'unsetUnderlierAllowanceForProxy'].includes(currentTxAction || '') && disableActions ? (
                  <Loading size='xs' />
                ) : null
              }
            />
            <Spacer x={0.5} />
            <Text>Allow <code>FIAT I</code> to transfer your {underlierSymbol}</Text>
          </Row>
          </Card.Body>
        </Card>
        <Spacer y={0.5} />
        { renderFormAlerts() }
        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (disableActions || !hasProxy) return true;
            if (leverStore.formErrors.length !== 0 || leverStore.formWarnings.length !== 0) return true;
            if (monetaDelegate === false) return true;
            if (upFrontUnderliersBN.isZero() && minTokenToBuy.isZero()) return true;
            if (!upFrontUnderliersBN.isZero() && underlierAllowance.lt(upFrontUnderliersBN)) return true;
            return false;
          })()}
          icon={
            [
              'buyCollateralAndIncreaseLever',
              'sellCollateralAndDecreaseLever',
              'redeemCollateralAndDecreaseLever'
            ].includes(currentTxAction || '') && disableActions ? (
              <Loading size='xs' />
            ) : null
          }
          onPress={async () => {
            try {
              setSubmitError('');
              await buyCollateralAndIncreaseLever(upFrontUnderliersBN, addDebt, minUnderliersToBuy, minTokenToBuy);
              onClose();
            } catch (e: any) {
              setSubmitError(e.message);
            }
          }}
        >
          Increase
        </Button>
      </Modal.Footer>
    </>
  );
}

export const LeverDecreaseForm = ({
  onClose,
  // TODO: refactor out into react query mutations / store actions
  sellCollateralAndDecreaseLever,
}: {
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  sellCollateralAndDecreaseLever: (subTokenAmount: BigNumber, subDebt: BigNumber, maxUnderlierToSell: BigNumber, minUnderlierToBuy: BigNumber) => any;
}) => {
  const [submitError, setSubmitError] = React.useState('');
  const leverStore = useLeverStore(
    React.useCallback(
      (state) => ({
        decreaseState: state.decreaseState,
        decreaseActions: state.decreaseActions,
        formDataLoading: state.formDataLoading,
        formWarnings: state.formWarnings,
        formErrors: state.formErrors,
      }),
      []
    ), shallow
  );
  const fiat = useStore(state => state.fiat);
  const hasProxy = useStore(state => state.hasProxy);
  const disableActions = useStore((state) => state.disableActions);
  const transactionData = useStore((state => state.transactionData));
  const modifyPositionData = useStore((state) => state.modifyPositionData);

  const {
    collateralType: {
      metadata: { symbol: tokenSymbol },
      properties: { underlierScale, underlierSymbol, tokenScale },
      state: { codex: { virtualRate }, collybus: { fairPrice } }
    },
    position
  } = modifyPositionData;
  const {
    subTokenAmount, collateralSlippagePct, underlierSlippagePct,
    maxUnderliersToSell, minUnderliersToBuy, targetedCollRatio,
    collateral, debt, collRatio, minCollRatio, maxCollRatio
  } = leverStore.decreaseState;
  const {
    setSubTokenAmount, setCollateralSlippagePct, setUnderlierSlippagePct, setTargetedCollRatio
  } = leverStore.decreaseActions;
  const { action: currentTxAction } = transactionData;

  const subTokenAmountBN = useMemo(() => {
    return leverStore.decreaseState.subTokenAmount === '' ? ZERO : decToScale(leverStore.decreaseState.subTokenAmount, tokenScale)
  }, [leverStore.decreaseState.subTokenAmount, tokenScale])
  
  const renderFormAlerts = () => {
    const formAlerts = [];

    if (leverStore.formWarnings.length !== 0) {
      leverStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (leverStore.formErrors.length !== 0) {
      leverStore.formErrors.forEach((formError, idx) => {
        formAlerts.push(<Alert severity='error' message={formError} key={`err-${idx}`} />);
      });
    }

    if (submitError !== '' && submitError !== 'ACTION_REJECTED') {
      formAlerts.push(<Alert severity='error' message={submitError} key={'error-submit'}/>);
    }

    return formAlerts;
  }

  return (
    <>
      <Modal.Body>
        <Text b size={'m'}>Inputs</Text>
        <Grid.Container
          gap={0}
          justify='space-between'
          css={{ marginBottom: '1rem' }}
        >
          <Grid>
            <NumericInput
              disabled={disableActions}
              value={underlierSlippagePct.toString()}
              onChange={(event) => { setUnderlierSlippagePct(fiat, event.target.value, modifyPositionData) }}
              placeholder='0.01'
              label='Slippage (Underlier to FIAT swap)'
              rightAdornment={'%'}
              style={{ width: '11.0rem' }}
            />
          </Grid>
          <Grid>
            <NumericInput
              disabled={disableActions}
              value={collateralSlippagePct.toString()}
              onChange={(event) => { setCollateralSlippagePct(fiat, event.target.value, modifyPositionData) }}
              placeholder='0.01'
              label='Slippage (Collateral to Underlier swap)'
              rightAdornment={'%'}
              style={{ width: '11.0rem' }}
            />
          </Grid>
        </Grid.Container>
        <NumericInput
          disabled={disableActions}
          value={subTokenAmount.toString()}
          onChange={(event) => { setSubTokenAmount(fiat, event.target.value, modifyPositionData) }}
          placeholder='0'
          label={
            <InputLabelWithMax
              label='Collateral to withdraw and swap'
              onMaxClick={() => {
                setSubTokenAmount(fiat, wadToDec(modifyPositionData.position.collateral).toString(), modifyPositionData)
              }}
            />
          }
          rightAdornment={tokenSymbol}
        />
        {(!minCollRatio.isZero() && !maxCollRatio.isZero() && !minCollRatio.eq(maxCollRatio)) && (
          <>
            <Text
              size={'0.75rem'}
              style={{ paddingLeft: '0.25rem', marginBottom: '0.375rem' }}
            >
              Targeted collateralization ratio ({floor2(wadToDec(targetedCollRatio.mul(100)))}%)
            </Text>
            <Card variant='bordered' borderWeight='light' style={{height:'100%'}}>
              <Card.Body
                style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem', overflow: 'hidden' }}
              >
                <RadixSlider
                  aria-label={'Targeted Collateralization Ratio'}
                  disabled={disableActions}
                  inverted
                  max={(maxCollRatio.eq(ethers.constants.MaxUint256)) ? 5.0 : floor4(wadToDec(maxCollRatio))}
                  maxLabel={'Safer'}
                  min={floor4(wadToDec(minCollRatio))}
                  minLabel={'Riskier'}
                  onChange={(value) => { setTargetedCollRatio(fiat, Number(value), modifyPositionData) }}
                  step={0.001}
                  value={[Number(wadToDec(targetedCollRatio))]}
                />
              </Card.Body>
            </Card>
          </>
        )}
        <Text size={'$sm'}>
          Note: The fees are due on the total leveraged amounts. Withdrawing collateral before maturity most likely will result in a loss.
        </Text>
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>Leveraged Swap Preview</Text>
        <Input
          readOnly
          value={(() => {
            if (leverStore.formDataLoading) return ' '
            return `${floor2(scaleToDec(maxUnderliersToSell, underlierScale))}`;
          })()}
          placeholder='0'
          type='string'
          label={'Underliers to cover flashloan (includes slippage)'}
          labelRight={underlierSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(() => {
            if (leverStore.formDataLoading) return ' '
            const underliersToWithdraw = minUnderliersToBuy.sub(maxUnderliersToSell);
            return `${floor2(scaleToDec(underliersToWithdraw, underlierScale))}`;
          })()}
          placeholder='0'
          type='string'
          label={'Underliers to withdraw (includes slippage)'}
          labelRight={underlierSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>Position Preview</Text>
        <Input
          readOnly
          value={(leverStore.formDataLoading)
            ? ' '
            : `${floor2(wadToDec(position.collateral))} → ${floor2(wadToDec(collateral))}`
          }
          placeholder='0'
          type='string'
          label={'Collateral'}
          labelRight={tokenSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(leverStore.formDataLoading)
            ? ' '
            : `${floor2(wadToDec(position.normalDebt.mul(virtualRate).div(WAD)))} → ${floor2(wadToDec(debt))}`
          }
          placeholder='0'
          type='string'
          label='Debt'
          labelRight={'FIAT'}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(() => {
            if (leverStore.formDataLoading) return ' ';
            let collRatioBefore = computeCollateralizationRatio(
              position.collateral, fairPrice, position.normalDebt, virtualRate
            );
            collRatioBefore = (collRatioBefore.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(collRatioBefore.mul(100)))}%`;
            const collRatioAfter = (collRatio.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(collRatio.mul(100)))}%`;
            return `${collRatioBefore} → ${collRatioAfter}`
          })()}
          placeholder='0'
          type='string'
          label='Collateralization Ratio'
          labelRight={'🚦'}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        {/* renderSummary() */}
      </Modal.Body>

      <Modal.Footer justify='space-evenly'>
        { renderFormAlerts() }
        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (disableActions || !hasProxy) return true;
            if (leverStore.formErrors.length !== 0 || leverStore.formWarnings.length !== 0) return true;
            if (subTokenAmountBN.isZero() && leverStore.decreaseState.subDebt.isZero()) return true;
            return false;
          })()}
          icon={
            [
              'buyCollateralAndIncreaseLever',
              'sellCollateralAndDecreaseLever',
              'redeemCollateralAndDecreaseLever'
            ].includes(currentTxAction || '') && disableActions ? (
              <Loading size='xs' />
            ) : null
          }
          onPress={async () => {
            try {
              setSubmitError('');
              await sellCollateralAndDecreaseLever(
                subTokenAmountBN,
                leverStore.decreaseState.subDebt,
                leverStore.decreaseState.maxUnderliersToSell,
                leverStore.decreaseState.minUnderliersToBuy
              );
              onClose();
            } catch (e: any) {
              setSubmitError(e.message);
            }
          }}
        >
          Decrease
        </Button>
      </Modal.Footer>
    </>
  );
}

export const LeverRedeemForm = ({
  onClose,
  // TODO: refactor out into react query mutations / store actions
  redeemCollateralAndDecreaseLever,
}: {
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  redeemCollateralAndDecreaseLever: (subTokenAmount: BigNumber, subDebt: BigNumber, maxUnderlierToSell: BigNumber) => any;
}) => {
  const [submitError, setSubmitError] = React.useState('');
  const leverStore = useLeverStore(
    React.useCallback(
      (state) => ({
        redeemState: state.redeemState,
        redeemActions: state.redeemActions,
        formDataLoading: state.formDataLoading,
        formWarnings: state.formWarnings,
        formErrors: state.formErrors,
      }),
      []
    ), shallow
  );
  const fiat = useStore(state => state.fiat);
  const hasProxy = useStore(state => state.hasProxy);
  const disableActions = useStore((state) => state.disableActions);
  const transactionData = useStore((state => state.transactionData));
  const modifyPositionData = useStore((state) => state.modifyPositionData);
  const {
    collateralType: {
      metadata: { symbol: tokenSymbol },
      properties: { underlierScale, underlierSymbol, tokenScale },
      state: { codex: { virtualRate }, collybus: { fairPrice } }
    },
    position
  } = modifyPositionData;
  const {
    subTokenAmount, underlierSlippagePct,
    maxUnderliersToSell, targetedCollRatio, underliersToRedeem,
    collateral, collRatio, debt, minCollRatio, maxCollRatio
  } = leverStore.redeemState;
  
  const { action: currentTxAction } = transactionData;
  
  const subTokenAmountBN = useMemo(() => {
    return leverStore.redeemState.subTokenAmount === '' ? ZERO : decToScale(leverStore.redeemState.subTokenAmount, tokenScale)
  }, [leverStore.redeemState.subTokenAmount, tokenScale])

  const renderFormAlerts = () => {
    const formAlerts = [];

    if (leverStore.formWarnings.length !== 0) {
      leverStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (leverStore.formErrors.length !== 0) {
      leverStore.formErrors.forEach((formError, idx) => {
        formAlerts.push(<Alert severity='error' message={formError} key={`err-${idx}`} />);
      });
    }

    if (submitError !== '' && submitError !== 'ACTION_REJECTED') {
      formAlerts.push(<Alert severity='error' message={submitError} key={'error-submit'}/>);
    }

    return formAlerts;
  }

  return (
    <>
      <Modal.Body>
        <Text b size={'m'}>
          Inputs
        </Text>
        <NumericInput
          disabled={disableActions}
          value={subTokenAmount.toString()}
          onChange={(event) => {
            leverStore.redeemActions.setSubTokenAmount(fiat, event.target.value, modifyPositionData);
          }}
          placeholder='0'
          label={
            <InputLabelWithMax
              label='Collateral to withdraw and redeem'
              onMaxClick={() => leverStore.redeemActions.setSubTokenAmount(fiat, wadToDec(modifyPositionData.position.collateral).toString(), modifyPositionData)}
            />
          }
          rightAdornment={modifyPositionData.collateralType.metadata.symbol}
          style={{ width: '100%' }}
        />
        <Grid.Container
          gap={0}
          justify='space-between'
          wrap='wrap'
          css={{ marginBottom: '1rem' }}
        >
          <NumericInput
            disabled={disableActions}
            value={underlierSlippagePct.toString()}
            onChange={(event) => {
              leverStore.redeemActions.setUnderlierSlippagePct(fiat, event.target.value, modifyPositionData);
            }}
            placeholder='0'
            label='Slippage (Underlier to FIAT swap)'
            rightAdornment={'%'}
            style={{ width: '15.0rem' }}
          />
        </Grid.Container>
        {(!minCollRatio.isZero() && !maxCollRatio.isZero() && !minCollRatio.eq(maxCollRatio)) && (
          <>
            <Text
              size={'0.75rem'}
              style={{ paddingLeft: '0.25rem', marginBottom: '0.375rem' }}
            >
              Targeted collateralization ratio ({floor2(wadToDec(targetedCollRatio.mul(100)))}%)
            </Text>
            <Card variant='bordered' borderWeight='light' style={{height:'100%'}}>
              <Card.Body
                style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem', overflow: 'hidden' }}
              >
                <RadixSlider
                  aria-label={'Targeted Collateralization Ratio'}
                  disabled={disableActions}
                  inverted
                  max={(maxCollRatio.eq(ethers.constants.MaxUint256)) ? 5.0 : floor4(wadToDec(maxCollRatio))}
                  maxLabel={'Safer'}
                  min={floor4(wadToDec(minCollRatio))}
                  minLabel={'Riskier'}
                  onValueChange={(value) => {
                    leverStore.redeemActions.setTargetedCollRatio(fiat, Number(value), modifyPositionData);
                  }}
                  step={0.001}
                  value={[Number(wadToDec(targetedCollRatio))]}
                />
              </Card.Body>
            </Card>
          </>
        )}
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>Leveraged Swap Preview</Text>
        <Input
          readOnly
          value={(() => {
            if (leverStore.formDataLoading) return ' '
            return `${floor2(scaleToDec(maxUnderliersToSell, underlierScale))}`;
          })()}
          placeholder='0'
          type='string'
          label={'Underliers to cover flashloan (includes slippage)'}
          labelRight={underlierSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(() => {
            if (leverStore.formDataLoading) return ' '
            const underliersToWithdraw = underliersToRedeem.sub(maxUnderliersToSell);
            return `${floor2(scaleToDec(underliersToWithdraw, underlierScale))}`;
          })()}
          placeholder='0'
          type='string'
          label={'Underliers to redeem'}
          labelRight={underlierSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>Position Preview</Text>
        <Input
          readOnly
          value={(leverStore.formDataLoading)
            ? ' '
            : `${floor2(wadToDec(position.collateral))} → ${floor2(wadToDec(collateral))}`
          }
          placeholder='0'
          type='string'
          label={'Collateral'}
          labelRight={tokenSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(leverStore.formDataLoading)
            ? ' '
            : `${floor2(wadToDec(position.normalDebt.mul(virtualRate).div(WAD)))} → ${floor2(wadToDec(debt))}`
          }
          placeholder='0'
          type='string'
          label='Debt'
          labelRight={'FIAT'}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(() => {
            if (leverStore.formDataLoading) return ' ';
            let collRatioBefore = computeCollateralizationRatio(
              position.collateral, fairPrice, position.normalDebt, virtualRate
            );
            collRatioBefore = (collRatioBefore.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(collRatioBefore.mul(100)))}%`;
            const collRatioAfter = (collRatio.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(collRatio.mul(100)))}%`;
            return `${collRatioBefore} → ${collRatioAfter}`
          })()}
          placeholder='0'
          type='string'
          label='Collateralization Ratio'
          labelRight={'🚦'}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        {/* renderSummary() */}
      </Modal.Body>

      <Modal.Footer justify='space-evenly'>
        { renderFormAlerts() }
        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (disableActions || !hasProxy) return true;
            if (leverStore.formErrors.length !== 0 || leverStore.formWarnings.length !== 0) return true;
            if (subTokenAmountBN.isZero() && leverStore.redeemState.subDebt.isZero()) return true;
            return false;
          })()}
          icon={
            [
              'buyCollateralAndIncreaseLever',
              'sellCollateralAndDecreaseLever',
              'redeemCollateralAndDecreaseLever'
            ].includes(currentTxAction || '') && disableActions ? (
              <Loading size='xs' />
            ) : null
          }
          onPress={async () => {
            try {
              setSubmitError('');
              await redeemCollateralAndDecreaseLever(
                subTokenAmountBN,
                leverStore.redeemState.subDebt,
                leverStore.redeemState.maxUnderliersToSell
              );
              onClose();
            } catch (e: any) {
              setSubmitError(e.message);
            }
          }}
        >
          Redeem
        </Button>
      </Modal.Footer>
    </>
  )
}
