import { decToScale, decToWad, normalDebtToDebt, scaleToDec, wadToDec, ZERO } from '@fiatdao/sdk';
import { Button, Card, Grid, Input, Loading, Modal, Row, Spacer, Switch, Text } from '@nextui-org/react';
import { BigNumber, ethers } from 'ethers';
import React, {useMemo} from 'react';
import shallow from 'zustand/shallow';
import { useBorrowStore } from '../../state/stores/borrowStore';
import { commifyToDecimalPlaces, floor2, floor4, minCollRatioWithBuffer } from '../../utils';
import { Alert } from '../Alert';
import { InputLabelWithMax } from '../InputLabelWithMax';
import { NumericInput } from '../NumericInput/NumericInput';
import { PositionPreview } from './PositionPreview';
import useStore from '../../state/stores/globalStore';
import { RadixSlider } from '../RadixSlider/RadixSlider';

export const CreateForm = ({
  onClose,
  // TODO: refactor out into react query mutations / store actions
  createPosition,
  setUnderlierAllowanceForProxy,
  unsetUnderlierAllowanceForProxy,
}: {
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  createPosition: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any;
  setUnderlierAllowanceForProxy: (fiat: any, amount: BigNumber) => any,
  unsetUnderlierAllowanceForProxy: (fiat: any) => any,
}) => {
  const modifyPositionData = useStore((state) => state.modifyPositionData);
  const {
    collateralType: {
      metadata: { symbol: tokenSymbol },
      properties: { underlierScale, underlierSymbol },
      settings: { collybus: { liquidationRatio } }
    },
    underlierAllowance,
    underlierBalance,
    monetaDelegate,
  } = modifyPositionData;
  const fiat = useStore(state => state.fiat);
  const hasProxy = useStore(state => state.hasProxy);
  const disableActions = useStore((state) => state.disableActions);
  const transactionData = useStore((state => state.transactionData));
  const { action: currentTxAction } = transactionData;

  const borrowStore = useBorrowStore(
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

  const underlierBN = useMemo(() => {
    return borrowStore.createState.underlier === '' ? ZERO : decToScale(borrowStore.createState.underlier, underlierScale)
  }, [borrowStore.createState.underlier, underlierScale])

  const [submitError, setSubmitError] = React.useState('');

  const minCollRatio = useMemo(() => minCollRatioWithBuffer(liquidationRatio), [liquidationRatio])

  if (
    !modifyPositionData.collateralType ||
    !modifyPositionData.collateralType.metadata
  ) {
    // TODO: add skeleton components instead of loading
    return null;
  }

  // const renderSummary = () => {
  //   if (borrowStore.createState.deltaCollateral.isZero()) {
  //     return null;
  //   }

  //   return (
  //     <>
  //       <Spacer y={0} />
  //       <Text b size={'m'}>Summary</Text>
  //       <Text size='0.75rem'>
  //         <>
  //           Swap <b>{floor2(scaleToDec(borrowStore.createState.underlier, modifyPositionData.collateralType.properties.underlierScale))} {modifyPositionData.collateralType.properties.underlierSymbol}</b> for<b> ~{floor2(wadToDec(borrowStore.createState.deltaCollateral))} {modifyPositionData.collateralType.metadata.symbol}</b>. Deposit <b>~{floor2(wadToDec(borrowStore.createState.deltaCollateral))} {modifyPositionData.collateralType.metadata.symbol}</b> as deltaCollateral. Borrow <b>~{floor2(wadToDec(borrowStore.createState.deltaDebt))} FIAT</b> against the deltaCollateral.
  //         </>
  //       </Text>
  //     </>
  //   );
  // }

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

    if (borrowStore.formWarnings.length !== 0) {
      borrowStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (borrowStore.formErrors.length !== 0) {
      borrowStore.formErrors.forEach((formError, idx) => {
        formAlerts.push(<Alert severity='error' message={formError} key={`err-${idx}`} />);
      });
    }

    if (submitError !== '' && submitError !== 'ACTION_REJECTED' ) {
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
        {underlierBalance && (
          <Text size={'$sm'}>
            Wallet:{' '}
            {commifyToDecimalPlaces(underlierBalance, underlierScale, 2)}{' '}
            {underlierSymbol}
          </Text>
        )}
        <Grid.Container
          gap={0}
          justify='space-between'
          css={{ marginBottom: '1rem' }}
        >
          <Grid>
            <NumericInput
              disabled={disableActions}
              value={borrowStore.createState.underlier.toString()}
              onChange={(event) => {
                borrowStore.createActions.setUnderlier(
                  fiat, event.target.value, modifyPositionData);
              }}
              label={'Underlier to swap'}
              placeholder='0'
              style={{ width: '15rem' }}
              rightAdornment={underlierSymbol}
            />
          </Grid>
          <Grid>
            <NumericInput
              disabled={disableActions}
              value={borrowStore.createState.slippagePct.toString()}
              onChange={(event) => {
                borrowStore.createActions.setSlippagePct(fiat, event.target.value, modifyPositionData);
              }}
              placeholder='0.01'
              inputMode='decimal'
              label='Slippage'
              rightAdornment={'%'}
              style={{ width: '7.5rem' }}
            />
          </Grid>
        </Grid.Container>
        <Text
          size={'0.75rem'}
          style={{ paddingLeft: '0.25rem', marginBottom: '0.375rem' }}
        >
          Targeted collateralization ratio ({floor2(wadToDec(borrowStore.createState.targetedCollRatio.mul(100)))}%)
        </Text>
        <Card variant='bordered' borderWeight='light' style={{height:'100%'}}>
          <Card.Body
            style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem', overflow: 'hidden' }}
          >
            <RadixSlider
              aria-label={'Targeted Collateralization Ratio'}
              disabled={disableActions}
              inverted
              max={5.0}
              maxLabel={'Safer'}
              min={floor4(wadToDec(minCollRatio))}
              minLabel={'Riskier'}
              onValueChange={(value) => {
                borrowStore.createActions.setTargetedCollRatio(fiat, Number(value), modifyPositionData);
              }}
              step={0.001}
              value={[Number(wadToDec(borrowStore.createState.targetedCollRatio))]}
            />
          </Card.Body>

        </Card>
      </Modal.Body>
      <Spacer y={0.75} />
      <Card.Divider />
      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>
          Swap Preview
        </Text>
        <Input
          readOnly
          value={borrowStore.formDataLoading ? ' ' : floor2(wadToDec(borrowStore.createState.deltaCollateral))}
          placeholder='0'
          type='string'
          label={'Collateral to deposit (incl. slippage)'}
          labelRight={tokenSymbol}
          contentLeft={borrowStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
      </Modal.Body>
      <Spacer y={0.75} />
      <Card.Divider />
      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>
          Position Preview
        </Text>
        <Input
          readOnly
          value={borrowStore.formDataLoading ? ' ' : floor2(wadToDec(borrowStore.createState.collateral))}
          placeholder='0'
          type='string'
          label={'Collateral'}
          labelRight={tokenSymbol}
          contentLeft={borrowStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={borrowStore.formDataLoading ? ' ' : floor2(wadToDec(borrowStore.createState.debt))}
          placeholder='0'
          type='string'
          label='Debt'
          labelRight={'FIAT'}
          contentLeft={borrowStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={
            borrowStore.formDataLoading
              ? ' '
              : borrowStore.createState.collRatio.eq(ethers.constants.MaxUint256)
                ? '∞'
                : `${floor2(wadToDec(borrowStore.createState.collRatio.mul(100)))}%`
          }
          placeholder='0'
          type='string'
          label='Collateralization Ratio'
          labelRight={'🚦'}
          contentLeft={borrowStore.formDataLoading ? <Loading size='xs' /> : null}
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
            checked={() => underlierAllowance?.gt(0) && underlierAllowance?.gte(underlierBN) ?? false}
            onChange={async () => {
              if (!underlierBN.isZero() && underlierAllowance?.gte(underlierBN)) {
                try {
                  setSubmitError('');
                  await unsetUnderlierAllowanceForProxy(fiat);
                } catch (e: any) {
                  setSubmitError(e.message);
                }
              } else {
                try {
                  setSubmitError('');
                  await setUnderlierAllowanceForProxy(fiat, underlierBN);
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
        { renderFormAlerts() }
        <Spacer y={0.5} />
        <Button
          css={{ minWidth: '100%' }}
          disabled={
            borrowStore.formErrors.length !== 0 ||
            borrowStore.formWarnings.length !== 0 ||
            disableActions ||
            !hasProxy ||
            underlierBN.isZero() ||
            borrowStore.createState.deltaCollateral?.isZero() ||
            underlierAllowance?.lt(underlierBN) ||
            monetaDelegate === false
          }
          icon={(disableActions && currentTxAction === 'createPosition') ? (<Loading size='xs' />) : null}
          onPress={async () => {
            try {
              setSubmitError('');
              await createPosition(
                borrowStore.createState.deltaCollateral, borrowStore.createState.deltaDebt, underlierBN
              );
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

export const IncreaseForm = ({
  onClose,
  // TODO: refactor out into react query mutations / store actions
  buyCollateralAndModifyDebt,
  setUnderlierAllowanceForProxy,
  unsetUnderlierAllowanceForProxy,
}: {
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  buyCollateralAndModifyDebt: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any,
  setUnderlierAllowanceForProxy: (fiat: any, amount: BigNumber) => any,
  unsetUnderlierAllowanceForProxy: (fiat: any) => any,
}) => {
  const [submitError, setSubmitError] = React.useState('');
  const borrowStore = useBorrowStore(
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
  const transactionData = useStore(state => state.transactionData);
  const modifyPositionData = useStore((state) => state.modifyPositionData);

  const underlierBN = useMemo(() => {
    return borrowStore.increaseState.underlier === '' ? ZERO : decToScale(borrowStore.increaseState.underlier, modifyPositionData.collateralType.properties.underlierScale)
  }, [borrowStore.increaseState.underlier, modifyPositionData.collateralType.properties.underlierScale])

  const deltaDebtBN = useMemo(() => {
    return borrowStore.increaseState.deltaDebt === '' ? ZERO : decToWad(borrowStore.increaseState.deltaDebt)
  }, [borrowStore.increaseState.deltaDebt])

  const { action: currentTxAction } = transactionData;
  
  const renderFormAlerts = () => {
    const formAlerts = [];

    if (borrowStore.formWarnings.length !== 0) {
      borrowStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (borrowStore.formErrors.length !== 0) {
      borrowStore.formErrors.forEach((formError, idx) => {
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
      {modifyPositionData.underlierBalance && (
        <Text size={'$sm'}>
          Wallet: {commifyToDecimalPlaces(modifyPositionData.underlierBalance, modifyPositionData.collateralType.properties.underlierScale, 2)} {modifyPositionData.collateralType.properties.underlierSymbol}
        </Text>
      )}
      <Grid.Container
        gap={0}
        justify='space-between'
        wrap='wrap'
        css={{ marginBottom: '1rem' }}
      >
        <NumericInput
          disabled={disableActions}
          value={borrowStore.increaseState.underlier.toString()}
          onChange={(event) => {
            borrowStore.increaseActions.setUnderlier(fiat, event.target.value, modifyPositionData);
          }}
          label={'Underlier to deposit'}
          placeholder='0'
          style={{ width: '15rem' }}
          rightAdornment={modifyPositionData.collateralType.properties.underlierSymbol}
        />

        <NumericInput
          disabled={disableActions}
          value={borrowStore.increaseState.slippagePct.toString()}
          onChange={(event) => {
            borrowStore.increaseActions.setSlippagePct(fiat, event.target.value, modifyPositionData);
          }}
          placeholder='0.01'
          label='Slippage'
          rightAdornment={'%'}
          style={{ width: '7.5rem' }}
        />
      </Grid.Container>
      <NumericInput
        disabled={disableActions}
        value={borrowStore.increaseState.deltaDebt.toString()}
        onChange={(event) => {
          borrowStore.increaseActions.setDeltaDebt(fiat, event.target.value, modifyPositionData);
        }}
        placeholder='0'
        label={'FIAT to borrow'}
        rightAdornment={'FIAT'}
      />
    </Modal.Body>

    <Spacer y={0.75} />
    <Card.Divider />

      <Modal.Body css={{ marginTop: 'var(--nextui-space-8)' }}>
        <Text b size={'m'}>
          Swap Preview
        </Text>
        <Input
          readOnly
          value={
            borrowStore.formDataLoading
              ? ' '
              : floor2(wadToDec(borrowStore.increaseState.deltaCollateral))
          }
          placeholder='0'
          type='string'
          label={'Collateral to deposit (incl. slippage)'}
          labelRight={modifyPositionData.collateralType.metadata.symbol}
          contentLeft={borrowStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body css={{ marginTop: 'var(--nextui-space-8)' }}>
        <PositionPreview
          formDataLoading={borrowStore.formDataLoading}
          positionCollateral={modifyPositionData.position.collateral}
          positionNormalDebt={modifyPositionData.position.normalDebt}
          estimatedCollateral={borrowStore.increaseState.collateral}
          estimatedCollateralRatio={borrowStore.increaseState.collRatio}
          estimatedDebt={borrowStore.increaseState.debt}
          virtualRate={modifyPositionData.collateralType.state.codex.virtualRate}
          fairPrice={modifyPositionData.collateralType.state.collybus.fairPrice}
          symbol={modifyPositionData.collateralType.metadata.symbol}
        />
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
              checked={() => modifyPositionData.underlierAllowance?.gt(0) && modifyPositionData.underlierAllowance?.gte(underlierBN) ?? false}
              onChange={async () => {
                if(!underlierBN.isZero() && modifyPositionData.underlierAllowance.gte(underlierBN)) {
                  try {
                    setSubmitError('');
                    await unsetUnderlierAllowanceForProxy(fiat);
                  } catch (e: any) {
                    setSubmitError(e.message);
                  }
                } else {
                  try {
                    setSubmitError('');
                    await setUnderlierAllowanceForProxy(fiat, underlierBN)
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
            <Text>Allow <code>FIAT I</code> to transfer your {modifyPositionData.collateralType.properties.underlierSymbol}</Text>
          </Row>
          </Card.Body>
        </Card>
        <Spacer y={0.5} />
        { renderFormAlerts() }
        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (disableActions || !hasProxy) return true;
            if (borrowStore.formErrors.length !== 0 || borrowStore.formWarnings.length !== 0) return true;
            if (modifyPositionData.monetaDelegate === false) return true;
            if (underlierBN.isZero() && deltaDebtBN.isZero()) return true;
            if (!underlierBN.isZero() && modifyPositionData.underlierAllowance.lt(underlierBN)) return true;
            return false;
          })()}
          icon={
            [
              'buyCollateralAndModifyDebt',
              'sellCollateralAndModifyDebt',
              'redeemCollateralAndModifyDebt',
            ].includes(currentTxAction || '') && disableActions ? (
              <Loading size='xs' />
            ) : null
          }
          onPress={async () => {
            try {
              setSubmitError('');
              await buyCollateralAndModifyDebt(borrowStore.increaseState.deltaCollateral, deltaDebtBN, underlierBN);
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

export const DecreaseForm = ({
  onClose,
  // TODO: refactor out into react query mutations / store actions
  setFIATAllowanceForProxy,
  unsetFIATAllowanceForProxy,
  setFIATAllowanceForMoneta,
  sellCollateralAndModifyDebt,
}: {
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  setFIATAllowanceForProxy: (fiat: any, amount: BigNumber) => any;
  setFIATAllowanceForMoneta: (fiat: any) => any;
  unsetFIATAllowanceForProxy: (fiat: any) => any;
  sellCollateralAndModifyDebt: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any;
}) => {
  const [submitError, setSubmitError] = React.useState('');
  const borrowStore = useBorrowStore(
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
  const modifyPositionData = useStore((state) => state.modifyPositionData);
  const transactionData = useStore(state => state.transactionData);

  const deltaCollateralBN = useMemo(() => {
    return borrowStore.decreaseState.deltaCollateral === '' ? ZERO : decToWad(borrowStore.decreaseState.deltaCollateral)
  }, [borrowStore.decreaseState.deltaCollateral])

  const deltaDebtBN = useMemo(() => {
    return borrowStore.decreaseState.deltaDebt === '' ? ZERO : decToWad(borrowStore.decreaseState.deltaDebt)
  }, [borrowStore.decreaseState.deltaDebt])

  const { action: currentTxAction } = transactionData;
  
  const renderFormAlerts = () => {
    const formAlerts = [];

    if (borrowStore.formWarnings.length !== 0) {
      borrowStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (borrowStore.formErrors.length !== 0) {
      borrowStore.formErrors.forEach((formError, idx) => {
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
        <Grid.Container
          gap={0}
          justify='space-between'
          wrap='wrap'
          css={{ marginBottom: '1rem' }}
        >
          <NumericInput
            disabled={disableActions}
            value={borrowStore.decreaseState.deltaCollateral.toString()}
            onChange={(event) => {
              borrowStore.decreaseActions.setDeltaCollateral(fiat, event.target.value, modifyPositionData);
            }}
            placeholder='0'
            inputMode='decimal'
            label={
              <InputLabelWithMax
                label='Collateral to withdraw and swap'
                onMaxClick={() => borrowStore.decreaseActions.setDeltaCollateral(fiat, wadToDec(modifyPositionData.position.collateral).toString(), modifyPositionData)}
              />
            }
            rightAdornment={modifyPositionData.collateralType.metadata.symbol}
            style={{ width: '15rem' }}
          />
          <NumericInput
            disabled={disableActions}
            value={borrowStore.decreaseState.slippagePct.toString()}
            onChange={(event) => {
              borrowStore.decreaseActions.setSlippagePct(fiat, event.target.value, modifyPositionData);
            }}
            placeholder='0.01'
            inputMode='decimal'
            label='Slippage'
            rightAdornment={'%'}
            style={{ width: '7.5rem' }}
          />
        </Grid.Container>
        <NumericInput
          disabled={disableActions}
          value={borrowStore.decreaseState.deltaDebt.toString()}
          onChange={(event) => {
            borrowStore.decreaseActions.setDeltaDebt(fiat, event.target.value, modifyPositionData);
          }}
          placeholder='0'
          label={
            <InputLabelWithMax
              label='FIAT to pay back'
              onMaxClick={() => borrowStore.decreaseActions.setDeltaDebt(fiat, wadToDec(normalDebtToDebt(modifyPositionData.position.normalDebt, modifyPositionData.collateralType.state.codex.virtualRate)).toString(), modifyPositionData)}
            />
          }
          rightAdornment={'FIAT'}
        />
        <Text size={'$sm'}>
          Note: When closing your position make sure you have enough FIAT to cover the accrued borrow fees.
        </Text>
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body css={{ marginTop: 'var(--nextui-space-8)' }}>
        <Text b size={'m'}>
          Swap Preview
        </Text>
        <Input
          readOnly
          value={
            (borrowStore.formDataLoading)
              ? ' '
              : floor2(scaleToDec(borrowStore.decreaseState.underlier, modifyPositionData.collateralType.properties.underlierScale))
          }
          placeholder='0'
          type='string'
          label={'Underliers to withdraw (incl. slippage)'}
          labelRight={modifyPositionData.collateralType.properties.underlierSymbol}
          contentLeft={borrowStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body css={{ marginTop: 'var(--nextui-space-8)' }}>
        <PositionPreview
          formDataLoading={borrowStore.formDataLoading}
          positionCollateral={modifyPositionData.position.collateral}
          positionNormalDebt={modifyPositionData.position.normalDebt}
          estimatedCollateral={borrowStore.decreaseState.collateral}
          estimatedCollateralRatio={borrowStore.decreaseState.collRatio}
          estimatedDebt={borrowStore.decreaseState.debt}
          virtualRate={modifyPositionData.collateralType.state.codex.virtualRate}
          fairPrice={modifyPositionData.collateralType.state.collybus.fairPrice}
          symbol={modifyPositionData.collateralType.metadata.symbol}
        />
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
                checked={() => (modifyPositionData.proxyFIATAllowance?.gt(0) && modifyPositionData.proxyFIATAllowance?.gte(deltaDebtBN) ?? false)}
                onChange={async () => {
                  if (deltaDebtBN.gt(0) && modifyPositionData.proxyFIATAllowance.gte(deltaDebtBN)) {
                    try {
                      setSubmitError('');
                      await unsetFIATAllowanceForProxy(fiat);
                    } catch (e: any) {
                      setSubmitError(e.message);
                    }
                  } else {
                    try {
                      setSubmitError('');
                      await setFIATAllowanceForProxy(fiat, deltaDebtBN);
                    } catch (e: any) {
                      setSubmitError(e.message);
                    }
                  }
                }}
                color='primary'
                icon={
                  ['setFIATAllowanceForProxy', 'unsetFIATAllowanceForProxy'].includes(currentTxAction || '') && disableActions ? (
                    <Loading size='xs' />
                  ) : null
                }
              />
              <Spacer x={0.5} />
              <Text>Allow <code>Proxy</code> to transfer your FIAT</Text>
            </Row>
            {modifyPositionData.monetaFIATAllowance?.lt(deltaDebtBN) && (
              <>
                <Spacer x={0.5} />
                <Row justify='flex-start'>
                  <Switch
                    disabled={disableActions || !hasProxy}
                    // Next UI Switch `checked` type is wrong, this is necessary
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    checked={() => (modifyPositionData.monetaFIATAllowance?.gt(0) && modifyPositionData.monetaFIATAllowance?.gte(deltaDebtBN) ?? false)}
                    onChange={async () => {
                      if (deltaDebtBN.gt(0) && modifyPositionData.monetaFIATAllowance.gte(deltaDebtBN)) {
                        try {
                          setSubmitError('');
                          // await unsetFIATAllowanceForMoneta(fiat);
                        } catch (e: any) {
                          setSubmitError(e.message);
                        }
                      } else {
                        try {
                          setSubmitError('');
                          await setFIATAllowanceForMoneta(fiat);
                        } catch (e: any) {
                          setSubmitError(e.message);
                        }
                      }
                    }}
                    color='primary'
                    icon={
                      ['setFIATAllowanceForMoneta', 'unsetFIATAllowanceForMoneta'].includes(currentTxAction || '') && disableActions ? (
                        <Loading size='xs' />
                      ) : null
                    }
                  />
                  <Spacer x={0.5} />
                  <Text>Allow <code>FIAT I</code> to transfer your FIAT (One Time)</Text>
                </Row>
              </>
            )}
          </Card.Body>
        </Card>
        <Spacer y={0.5} />
        { renderFormAlerts() }
        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (disableActions || !hasProxy) return true;
            if (borrowStore.formErrors.length !== 0 || borrowStore.formWarnings.length !== 0) return true;
            if (deltaCollateralBN.isZero() && deltaDebtBN.isZero()) return true;
            if (!deltaDebtBN.isZero() && modifyPositionData.monetaFIATAllowance?.lt(deltaDebtBN)) return true;
            return false;
          })()}
          icon={
            [
              'buyCollateralAndModifyDebt',
              'sellCollateralAndModifyDebt',
              'redeemCollateralAndModifyDebt',
            ].includes(currentTxAction || '') && disableActions ? (
              <Loading size='xs' />
            ) : null
          }
          onPress={async () => {
            try {
              setSubmitError('');
              await sellCollateralAndModifyDebt(deltaCollateralBN, deltaDebtBN, borrowStore.decreaseState.underlier);
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

export const RedeemForm = ({
  onClose,
  // TODO: refactor out into react query mutations / store actions
  setFIATAllowanceForProxy,
  unsetFIATAllowanceForProxy,
  setFIATAllowanceForMoneta,
  redeemCollateralAndModifyDebt,
}: {
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  setFIATAllowanceForProxy: (fiat: any, amount: BigNumber) => any;
  setFIATAllowanceForMoneta: (fiat: any) => any;
  unsetFIATAllowanceForProxy: (fiat: any) => any;
  redeemCollateralAndModifyDebt: (deltaCollateral: BigNumber, deltaDebt: BigNumber) => any;
}) => {
  const [submitError, setSubmitError] = React.useState('');
  const borrowStore = useBorrowStore(
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
  const modifyPositionData = useStore((state) => state.modifyPositionData);
  const transactionData = useStore(state => state.transactionData);

  const deltaCollateralBN = useMemo(() => {
    return borrowStore.redeemState.deltaCollateral === '' ? ZERO : decToWad(borrowStore.redeemState.deltaCollateral)
  }, [borrowStore.redeemState.deltaCollateral])

  const deltaDebtBN = useMemo(() => {
    return borrowStore.redeemState.deltaDebt === '' ? ZERO : decToWad(borrowStore.redeemState.deltaDebt)
  }, [borrowStore.redeemState.deltaDebt])

  const { action: currentTxAction } = transactionData;
  
  const renderFormAlerts = () => {
    const formAlerts = [];

    if (borrowStore.formWarnings.length !== 0) {
      borrowStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (borrowStore.formErrors.length !== 0) {
      borrowStore.formErrors.forEach((formError, idx) => {
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
        <Grid.Container
          gap={0}
          justify='space-between'
          wrap='wrap'
          css={{ marginBottom: '1rem' }}
        >
          <NumericInput
            disabled={disableActions}
            value={borrowStore.redeemState.deltaCollateral.toString()}
            onChange={(event) => {
              borrowStore.redeemActions.setDeltaCollateral(fiat, event.target.value, modifyPositionData);
            }}
            placeholder='0'
            label={
              <InputLabelWithMax
                label='Collateral to withdraw and redeem'
                onMaxClick={() => borrowStore.redeemActions.setDeltaCollateral(fiat, wadToDec(modifyPositionData.position.collateral).toString(), modifyPositionData)} />
            }
            rightAdornment={modifyPositionData.collateralType.metadata.symbol}
            style={{ width: '100%' }}
          />
        </Grid.Container>
        <NumericInput
          disabled={disableActions}
          value={borrowStore.redeemState.deltaDebt.toString()}
          onChange={(event) => {
            borrowStore.redeemActions.setDeltaDebt(fiat, event.target.value,modifyPositionData);
          }}
          placeholder='0'
          label={
            <InputLabelWithMax
              label='FIAT to pay back'
              onMaxClick={() => borrowStore.redeemActions.setDeltaDebt(fiat, wadToDec(normalDebtToDebt(modifyPositionData.position.normalDebt, modifyPositionData.collateralType.state.codex.virtualRate)).toString(), modifyPositionData)} />
          }
          rightAdornment={'FIAT'}
        />
        <Text size={'$sm'}>
          Note: When closing your position make sure you have enough FIAT to cover the accrued borrow fees.
        </Text>
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body css={{ marginTop: 'var(--nextui-space-8)' }}>
        <PositionPreview
          formDataLoading={borrowStore.formDataLoading}
          positionCollateral={modifyPositionData.position.collateral}
          positionNormalDebt={modifyPositionData.position.normalDebt}
          estimatedCollateral={borrowStore.redeemState.collateral}
          estimatedCollateralRatio={borrowStore.redeemState.collRatio}
          estimatedDebt={borrowStore.redeemState.debt}
          virtualRate={modifyPositionData.collateralType.state.codex.virtualRate}
          fairPrice={modifyPositionData.collateralType.state.collybus.fairPrice}
          symbol={modifyPositionData.collateralType.metadata.symbol}
        />
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
                checked={() => (modifyPositionData.proxyFIATAllowance?.gt(0) && modifyPositionData.proxyFIATAllowance?.gte(deltaDebtBN) ?? false)}
                onChange={async () => {
                  if (deltaDebtBN.gt(0) && modifyPositionData.proxyFIATAllowance.gte(deltaDebtBN)) {
                    try {
                      setSubmitError('');
                      await unsetFIATAllowanceForProxy(fiat);
                    } catch (e: any) {
                      setSubmitError(e.message);
                    }
                  } else {
                    try {
                      setSubmitError('');
                      await setFIATAllowanceForProxy(fiat, deltaDebtBN);
                    } catch (e: any) {
                      setSubmitError(e.message);
                    }
                  }
                }}
                color='primary'
                icon={
                  ['setFIATAllowanceForProxy', 'unsetFIATAllowanceForProxy'].includes(currentTxAction || '') && disableActions ? (
                    <Loading size='xs' />
                ) : null
                }
              />
              <Spacer x={0.5} />
              <Text>Allow <code>Proxy</code> to transfer your FIAT</Text>
            </Row>
            {modifyPositionData.monetaFIATAllowance?.lt(deltaDebtBN) && (
              <>
                <Spacer x={0.5} />
                <Row justify='flex-start'>
                  <Switch
                    disabled={disableActions || !hasProxy}
                    // Next UI Switch `checked` type is wrong, this is necessary
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    checked={() => (modifyPositionData.monetaFIATAllowance?.gt(0) && modifyPositionData.monetaFIATAllowance?.gte(deltaDebtBN) ?? false)}
                    onChange={async () => {
                      if (deltaDebtBN.gt(0) && modifyPositionData.monetaFIATAllowance.gte(deltaDebtBN)) {
                        try {
                          setSubmitError('');
                          // await unsetFIATAllowanceForMoneta(fiat);
                        } catch (e: any) {
                          setSubmitError(e.message);
                        }
                      } else {
                        try {
                          setSubmitError('');
                          await setFIATAllowanceForMoneta(fiat);
                        } catch (e: any) {
                          setSubmitError(e.message);
                        }
                      }
                    }}
                    color='primary'
                    icon={
                      ['setFIATAllowanceForMoneta', 'unsetFIATAllowanceForMoneta'].includes(currentTxAction || '') && disableActions ? (
                        <Loading size='xs' />
                      ) : null
                    }
                  />
                  <Spacer x={0.5} />
                  <Text>Allow <code>FIAT I</code> to transfer your FIAT (One Time)</Text>
                </Row>
              </>
            )}
          </Card.Body>
        </Card>

        <Spacer y={0.5} />
        { renderFormAlerts() }

        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (disableActions || !hasProxy) return true;
            if (borrowStore.formErrors.length !== 0 || borrowStore.formWarnings.length !== 0) return true;
            if (deltaCollateralBN.isZero() && deltaDebtBN.isZero()) return true;
            if (!deltaDebtBN.isZero() && modifyPositionData.monetaFIATAllowance?.lt(deltaDebtBN)) return true;
            return false;
          })()}
          icon={
            [
              'buyCollateralAndModifyDebt',
              'sellCollateralAndModifyDebt',
              'redeemCollateralAndModifyDebt',
            ].includes(currentTxAction || '') && disableActions ? (
              <Loading size='xs' />
            ) : null
          }
          onPress={async () => {
            try {
              setSubmitError('');
              await redeemCollateralAndModifyDebt(deltaCollateralBN, deltaDebtBN);
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
