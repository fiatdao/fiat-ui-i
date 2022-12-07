import { scaleToDec, wadToDec } from '@fiatdao/sdk';
import { Button, Card, Grid, Input, Loading, Modal, Spacer, Switch, Text } from '@nextui-org/react';
import { Slider } from 'antd';
import 'antd/dist/antd.css';
import { BigNumber, ethers } from 'ethers';
import React from 'react';
import shallow from 'zustand/shallow';
import { useLeverStore } from '../../stores/leverStore';
import { commifyToDecimalPlaces, floor2, floor5 } from '../../utils';
import { Alert } from '../Alert';
import { InputLabelWithMax } from '../InputLabelWithMax';
import { PositionPreview } from './PositionPreview';

export const LeverCreateForm = ({
  contextData,
  disableActions,
  modifyPositionData,
  transactionData,
  onClose,
  // TODO: refactor out into react query mutations / store actions
  createPosition,
  setUnderlierAllowanceForProxy,
  unsetUnderlierAllowanceForProxy,
}: {
  contextData: any,
  disableActions: boolean,
  modifyPositionData: any,
  transactionData: any,
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  createPosition: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any;
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

  const [submitError, setSubmitError] = React.useState('');

  if (
    !modifyPositionData.collateralType ||
    !modifyPositionData.collateralType.metadata
  ) {
    // TODO: add skeleton components instead of loading
    return null;
  }

  const { proxies } = contextData;
  const {
    collateralType: {
      metadata: { symbol: tokenSymbol },
      properties: { underlierScale, underlierSymbol },
    },
    underlierAllowance,
    underlierBalance,
    monetaDelegate,
  } = modifyPositionData;

  const { action: currentTxAction } = transactionData;

  const hasProxy = proxies.length > 0;

  // const renderSummary = () => {
  //   if (leverStore.createState.deltaCollateral.isZero()) {
  //     return null;
  //   }

  //   return (
  //     <>
  //       <Spacer y={0} />
  //       <Text b size={'m'}>Summary</Text>
  //       <Text size='0.75rem'>
  //         <>
  //           Swap <b>{floor2(scaleToDec(leverStore.createState.underlier, modifyPositionData.collateralType.properties.underlierScale))} {modifyPositionData.collateralType.properties.underlierSymbol}</b> for<b> ~{floor2(wadToDec(leverStore.createState.deltaCollateral))} {modifyPositionData.collateralType.metadata.symbol}</b>. Deposit <b>~{floor2(wadToDec(leverStore.createState.deltaCollateral))} {modifyPositionData.collateralType.metadata.symbol}</b> as deltaCollateral. Borrow <b>~{floor2(wadToDec(leverStore.createState.deltaDebt))} FIAT</b> against the deltaCollateral.
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
            <Input
              disabled={disableActions}
              value={floor2(scaleToDec(leverStore.createState.underlier, underlierScale))}
              onChange={(event) => {
                leverStore.createActions.setUnderlier(
                  contextData.fiat, event.target.value, modifyPositionData);
              }}
              placeholder='0'
              inputMode='decimal'
              label={'Underlier to swap'}
              labelRight={underlierSymbol}
              bordered
              size='sm'
              borderWeight='light'
              width='15rem'
            />
          </Grid>
          <Grid>
            <Input
              disabled={disableActions}
              value={floor2(Number(wadToDec(leverStore.createState.slippagePct)) * 100)}
              onChange={(event) => {
                leverStore.createActions.setSlippagePct(contextData.fiat, event.target.value, modifyPositionData);
              }}
              step='0.01'
              placeholder='0'
              inputMode='decimal'
              label='Slippage'
              labelRight={'%'}
              bordered
              size='sm'
              borderWeight='light'
              width='7.5rem'
            />
          </Grid>
        </Grid.Container>
        <Text
          size={'0.75rem'}
          style={{ paddingLeft: '0.25rem', marginBottom: '0.375rem' }}
        >
          Targeted collateralization ratio ({floor2(wadToDec(leverStore.createState.targetedCollRatio.mul(100)))}%)
        </Text>
        <Card variant='bordered' borderWeight='light' style={{height:'100%'}}>
          <Card.Body
            style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem', overflow: 'hidden' }}
          >
            <Slider
              handleStyle={{ borderColor: '#0072F5' }}
              included={false}
              disabled={disableActions}
              value={Number(wadToDec(leverStore.createState.targetedCollRatio))}
              onChange={(value) => {
                leverStore.createActions.setTargetedCollRatio(contextData.fiat, value, modifyPositionData);
              }}
              min={1.001}
              max={5.0}
              step={0.001}
              reverse
              marks={{
                5.0: {
                  style: { color: 'grey', fontSize: '0.75rem' },
              label: 'Safe',
              },
              4.0: {
                style: { color: 'grey', fontSize: '0.75rem' },
              label: '400%',
              },
              3.0: {
                style: { color: 'grey', fontSize: '0.75rem' },
              label: '300%',
              },
              2.0: {
                style: { color: 'grey', fontSize: '0.75rem' },
              label: '200%',
              },
              1.001: {
                style: {
                  color: 'grey',
                  fontSize: '0.75rem',
                  borderColor: 'white',
              },
              label: 'Unsafe',
              },
              }}
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
          value={leverStore.formDataLoading ? ' ' : floor2(wadToDec(leverStore.createState.deltaCollateral))}
          placeholder='0'
          type='string'
          label={'Collateral to deposit (incl. slippage)'}
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
        <Text b size={'m'}>
          Position Preview
        </Text>
        <Input
          readOnly
          value={leverStore.formDataLoading ? ' ' : floor2(wadToDec(leverStore.createState.collateral))}
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
          value={leverStore.formDataLoading ? ' ' : floor2(wadToDec(leverStore.createState.debt))}
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
          value={
            leverStore.formDataLoading
              ? ' '
              : leverStore.createState.collRatio.eq(ethers.constants.MaxUint256)
                ? '∞'
                : `${floor2(wadToDec(leverStore.createState.collRatio.mul(100)))}%`
          }
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
        <Text size={'0.875rem'}>Approve {underlierSymbol}</Text>
        <Switch
          disabled={disableActions || !hasProxy}
          // Next UI Switch `checked` type is wrong, this is necessary
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          checked={() => underlierAllowance?.gt(0) && underlierAllowance?.gte(leverStore.createState.underlier) ?? false}
          onChange={async () => {
            if (!leverStore.createState.underlier.isZero() && underlierAllowance?.gte(leverStore.createState.underlier)) {
              try {
                setSubmitError('');
                await unsetUnderlierAllowanceForProxy(contextData.fiat);
              } catch (e: any) {
                setSubmitError(e.message);
              }
            } else {
              try {
                setSubmitError('');
                await setUnderlierAllowanceForProxy(contextData.fiat, leverStore.createState.underlier);
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
        <Spacer y={3} />
        { renderFormAlerts() }
        <Spacer y={0.5} />
        <Button
          css={{ minWidth: '100%' }}
          disabled={
            leverStore.formErrors.length !== 0 ||
            leverStore.formWarnings.length !== 0 ||
            disableActions ||
            !hasProxy ||
            leverStore.createState.underlier?.isZero() ||
            leverStore.createState.deltaCollateral?.isZero() ||
            underlierAllowance?.lt(leverStore.createState.underlier) ||
            monetaDelegate === false
          }
          icon={(disableActions && currentTxAction === 'createPosition') ? (<Loading size='xs' />) : null}
          onPress={async () => {
            try {
              setSubmitError('');
              await createPosition(
                leverStore.createState.deltaCollateral, leverStore.createState.deltaDebt, leverStore.createState.underlier
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

export const LeverIncreaseForm = ({
  contextData,
  disableActions,
  modifyPositionData,
  transactionData,
  onClose,
  // TODO: refactor out into react query mutations / store actions
  buyCollateralAndModifyDebt,
  setUnderlierAllowanceForProxy,
  unsetUnderlierAllowanceForProxy,
}: {
  contextData: any,
  disableActions: boolean,
  modifyPositionData: any,
  transactionData: any,
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  buyCollateralAndModifyDebt: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any,
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

  const hasProxy = contextData.proxies.length > 0;
  const { action: currentTxAction } = transactionData;
  
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
        <Input
          label={'Underlier to deposit'}
          disabled={disableActions}
          value={floor2(scaleToDec(leverStore.increaseState.underlier, modifyPositionData.collateralType.properties.underlierScale))}
          onChange={(event) => {
            leverStore.increaseActions.setUnderlier(contextData.fiat, event.target.value, modifyPositionData);
          }}
          placeholder='0'
          inputMode='decimal'
          labelRight={modifyPositionData.collateralType.properties.underlierSymbol}
          bordered
          size='sm'
          borderWeight='light'
          width='15rem'
        />
        <Input
          disabled={disableActions}
          value={floor2(Number(wadToDec(leverStore.increaseState.slippagePct)) * 100)}
          onChange={(event) => {
            leverStore.increaseActions.setSlippagePct(contextData.fiat, event.target.value, modifyPositionData);
          }}
          step='0.01'
          placeholder='0'
          inputMode='decimal'
          label='Slippage'
          labelRight={'%'}
          bordered
          size='sm'
          borderWeight='light'
          width='7.5rem'
        />
      </Grid.Container>
      <Input
        disabled={disableActions}
        value={floor5(wadToDec(leverStore.increaseState.deltaDebt))}
        onChange={(event) => {
          leverStore.increaseActions.setDeltaDebt(contextData.fiat, event.target.value,modifyPositionData);
        }}
        placeholder='0'
        inputMode='decimal'
        label={'FIAT to borrow'}
        labelRight={'FIAT'}
        bordered
        size='sm'
        borderWeight='light'
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
            leverStore.formDataLoading
              ? ' '
              : floor2(wadToDec(leverStore.increaseState.deltaCollateral))
          }
          placeholder='0'
          type='string'
          label={'Collateral to deposit (incl. slippage)'}
          labelRight={modifyPositionData.collateralType.metadata.symbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body css={{ marginTop: 'var(--nextui-space-8)' }}>
        <PositionPreview
          formDataLoading={leverStore.formDataLoading}
          positionCollateral={modifyPositionData.position.collateral}
          positionNormalDebt={modifyPositionData.position.normalDebt}
          estimatedCollateral={leverStore.increaseState.collateral}
          estimatedCollateralRatio={leverStore.increaseState.collRatio}
          estimatedDebt={leverStore.increaseState.debt}
          virtualRate={modifyPositionData.collateralType.state.codex.virtualRate}
          fairPrice={modifyPositionData.collateralType.state.collybus.fairPrice}
          symbol={modifyPositionData.collateralType.metadata.symbol}
        />
      </Modal.Body>

      <Modal.Footer justify='space-evenly'>
        <Text size={'0.875rem'}>Approve {modifyPositionData.collateralType.properties.underlierSymbol}</Text>
        <Switch
          disabled={disableActions || !hasProxy}
          // Next UI Switch `checked` type is wrong, this is necessary
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          checked={() => modifyPositionData.underlierAllowance?.gt(0) && modifyPositionData.underlierAllowance?.gte(leverStore.increaseState.underlier) ?? false}
          onChange={async () => {
            if(!leverStore.increaseState.underlier.isZero() && modifyPositionData.underlierAllowance.gte(leverStore.increaseState.underlier)) {
              try {
                setSubmitError('');
                await unsetUnderlierAllowanceForProxy(contextData.fiat);
              } catch (e: any) {
                setSubmitError(e.message);
              }
            } else {
              try {
                setSubmitError('');
                await setUnderlierAllowanceForProxy(contextData.fiat, leverStore.increaseState.underlier)
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

        <Spacer y={3} />

        { renderFormAlerts() }

        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (disableActions || !hasProxy) return true;
            if (leverStore.formErrors.length !== 0 || leverStore.formWarnings.length !== 0) return true;
            if (modifyPositionData.monetaDelegate === false) return true;
            if (leverStore.increaseState.underlier.isZero() && leverStore.increaseState.deltaDebt.isZero()) return true;
            if (!leverStore.increaseState.underlier.isZero() && modifyPositionData.underlierAllowance.lt(leverStore.increaseState.underlier)) return true;
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
              await buyCollateralAndModifyDebt(leverStore.increaseState.deltaCollateral, leverStore.increaseState.deltaDebt, leverStore.increaseState.underlier);
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
  contextData,
  disableActions,
  modifyPositionData,
  transactionData,
  onClose,
  // TODO: refactor out into react query mutations / store actions
  setFIATAllowanceForProxy,
  unsetFIATAllowanceForProxy,
  setFIATAllowanceForMoneta,
  sellCollateralAndModifyDebt,
}: {
  contextData: any,
  disableActions: boolean,
  modifyPositionData: any,
  transactionData: any,
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  setFIATAllowanceForProxy: (fiat: any, amount: BigNumber) => any;
  setFIATAllowanceForMoneta: (fiat: any) => any;
  unsetFIATAllowanceForProxy: (fiat: any) => any;
  sellCollateralAndModifyDebt: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any;
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

  const hasProxy = contextData.proxies.length > 0;
  const { action: currentTxAction } = transactionData;
  
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
        <Grid.Container
          gap={0}
          justify='space-between'
          wrap='wrap'
          css={{ marginBottom: '1rem' }}
        >
          <Input
            disabled={disableActions}
            value={floor2(wadToDec(leverStore.decreaseState.deltaCollateral))}
            onChange={(event) => {
              leverStore.decreaseActions.setDeltaCollateral(contextData.fiat, event.target.value, modifyPositionData);
            }}
            placeholder='0'
            inputMode='decimal'
            // Bypass type warning from passing a custom component instead of a string
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            label={
              <InputLabelWithMax
                label='Collateral to withdraw and swap'
                onMaxClick={() => leverStore.decreaseActions.setMaxDeltaCollateral(contextData.fiat, modifyPositionData)}
              />
            }
            labelRight={modifyPositionData.collateralType.metadata.symbol}
            bordered
            size='sm'
            borderWeight='light'
            width={'15rem'}
          />
          <Input
            disabled={disableActions}
            value={floor2(Number(wadToDec(leverStore.decreaseState.slippagePct)) * 100)}
            onChange={(event) => {
              leverStore.decreaseActions.setSlippagePct(contextData.fiat, event.target.value, modifyPositionData);
            }}
            step='0.01'
            placeholder='0'
            inputMode='decimal'
            label='Slippage'
            labelRight={'%'}
            bordered
            size='sm'
            borderWeight='light'
            width='7.5rem'
          />
        </Grid.Container>
        <Input
          disabled={disableActions}
          value={floor5(wadToDec(leverStore.decreaseState.deltaDebt))}
          onChange={(event) => {
            leverStore.decreaseActions.setDeltaDebt(contextData.fiat, event.target.value,modifyPositionData);
          }}
          placeholder='0'
          inputMode='decimal'
          // Bypass type warning from passing a custom component instead of a string
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          label={
            <InputLabelWithMax
              label='FIAT to pay back'
              onMaxClick={() => leverStore.decreaseActions.setMaxDeltaDebt(contextData.fiat, modifyPositionData)}
            />
          }
          labelRight={'FIAT'}
          bordered
          size='sm'
          borderWeight='light'
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
            (leverStore.formDataLoading)
              ? ' '
              : floor2(scaleToDec(leverStore.decreaseState.underlier, modifyPositionData.collateralType.properties.underlierScale))
          }
          placeholder='0'
          type='string'
          label={'Underliers to withdraw (incl. slippage)'}
          labelRight={modifyPositionData.collateralType.properties.underlierSymbol}
          contentLeft={leverStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body css={{ marginTop: 'var(--nextui-space-8)' }}>
        <PositionPreview
          formDataLoading={leverStore.formDataLoading}
          positionCollateral={modifyPositionData.position.collateral}
          positionNormalDebt={modifyPositionData.position.normalDebt}
          estimatedCollateral={leverStore.decreaseState.collateral}
          estimatedCollateralRatio={leverStore.decreaseState.collRatio}
          estimatedDebt={leverStore.decreaseState.debt}
          virtualRate={modifyPositionData.collateralType.state.codex.virtualRate}
          fairPrice={modifyPositionData.collateralType.state.collybus.fairPrice}
          symbol={modifyPositionData.collateralType.metadata.symbol}
        />
      </Modal.Body>

      <Modal.Footer justify='space-evenly'>
        <Text size={'0.875rem'}>Approve FIAT for Proxy</Text>
        <Switch
          disabled={disableActions || !hasProxy}
          // Next UI Switch `checked` type is wrong, this is necessary
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          checked={() => (modifyPositionData.proxyFIATAllowance?.gt(0) && modifyPositionData.proxyFIATAllowance?.gte(leverStore.decreaseState.deltaDebt) ?? false)}
          onChange={async () => {
            if (leverStore.decreaseState.deltaDebt.gt(0) && modifyPositionData.proxyFIATAllowance.gte(leverStore.decreaseState.deltaDebt)) {
              try {
                setSubmitError('');
                await unsetFIATAllowanceForProxy(contextData.fiat);
              } catch (e: any) {
                setSubmitError(e.message);
              }
            } else {
              try {
                setSubmitError('');
                await setFIATAllowanceForProxy(contextData.fiat, leverStore.decreaseState.deltaDebt);
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

        <Spacer y={3} />

        {modifyPositionData.monetaFIATAllowance?.lt(leverStore.decreaseState.deltaDebt) && (
          <>
            <Spacer y={3} />
            <Button
              css={{ minWidth: '100%' }}
              disabled={(() => {
                if (disableActions || !hasProxy) return true;
                if (modifyPositionData.monetaFIATAllowance?.gt(0) && modifyPositionData.monetaFIATAllowance?.gte(leverStore.decreaseState.deltaDebt)) return true;
                return false;
              })()}
              icon={(['setFIATAllowanceForMoneta'].includes(currentTxAction || '') && disableActions)
                ? (<Loading size='xs' />)
                : null
              }
              onPress={async () => {
                try {
                  setSubmitError('');
                  await setFIATAllowanceForMoneta(contextData.fiat);
                } catch (e: any) {
                  setSubmitError(e.message);
                }
              }}
            >
              Approve FIAT for Moneta (One Time Action)
            </Button>
          </>
        )}

        { renderFormAlerts() }

        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (disableActions || !hasProxy) return true;
            if (leverStore.formErrors.length !== 0 || leverStore.formWarnings.length !== 0) return true;
            if (leverStore.decreaseState.deltaCollateral.isZero() && leverStore.decreaseState.deltaDebt.isZero()) return true;
            if (!leverStore.decreaseState.deltaDebt.isZero() && modifyPositionData.monetaFIATAllowance?.lt(leverStore.decreaseState.deltaDebt)) return true;
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
              await sellCollateralAndModifyDebt(leverStore.decreaseState.deltaCollateral, leverStore.decreaseState.deltaDebt, leverStore.decreaseState.underlier);
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
  contextData,
  disableActions,
  modifyPositionData,
  transactionData,
  onClose,
  // TODO: refactor out into react query mutations / store actions
  setFIATAllowanceForProxy,
  unsetFIATAllowanceForProxy,
  setFIATAllowanceForMoneta,
  redeemCollateralAndModifyDebt,
}: {
  contextData: any,
  disableActions: boolean,
  modifyPositionData: any,
  transactionData: any,
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  setFIATAllowanceForProxy: (fiat: any, amount: BigNumber) => any;
  setFIATAllowanceForMoneta: (fiat: any) => any;
  unsetFIATAllowanceForProxy: (fiat: any) => any;
  redeemCollateralAndModifyDebt: (deltaCollateral: BigNumber, deltaDebt: BigNumber) => any;
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

  const hasProxy = contextData.proxies.length > 0;
  const { action: currentTxAction } = transactionData;
  
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
        <Grid.Container
          gap={0}
          justify='space-between'
          wrap='wrap'
          css={{ marginBottom: '1rem' }}
        >
          <Input
            disabled={disableActions}
            value={floor2(wadToDec(leverStore.redeemState.deltaCollateral))}
            onChange={(event) => {
              leverStore.redeemActions.setDeltaCollateral(contextData.fiat, event.target.value, modifyPositionData);
            }}
            placeholder='0'
            inputMode='decimal'
            // Bypass type warning from passing a custom component instead of a string
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            label={<InputLabelWithMax label='Collateral to withdraw and redeem' onMaxClick={() => leverStore.redeemActions.setMaxDeltaCollateral(contextData.fiat, modifyPositionData)} /> }
            labelRight={modifyPositionData.collateralType.metadata.symbol}
            bordered
            size='sm'
            borderWeight='light'
            width={'100%'}
          />
        </Grid.Container>
        <Input
          disabled={disableActions}
          value={floor5(wadToDec(leverStore.redeemState.deltaDebt))}
          onChange={(event) => {
            leverStore.redeemActions.setDeltaDebt(contextData.fiat, event.target.value,modifyPositionData);
          }}
          placeholder='0'
          inputMode='decimal'
          // Bypass type warning from passing a custom component instead of a string
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          label={<InputLabelWithMax label='FIAT to pay back' onMaxClick={() => leverStore.redeemActions.setMaxDeltaDebt(contextData.fiat, modifyPositionData)} />}
          labelRight={'FIAT'}
          bordered
          size='sm'
          borderWeight='light'
        />
        <Text size={'$sm'}>
          Note: When closing your position make sure you have enough FIAT to cover the accrued borrow fees.
        </Text>
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body css={{ marginTop: 'var(--nextui-space-8)' }}>
        <PositionPreview
          formDataLoading={leverStore.formDataLoading}
          positionCollateral={modifyPositionData.position.collateral}
          positionNormalDebt={modifyPositionData.position.normalDebt}
          estimatedCollateral={leverStore.redeemState.collateral}
          estimatedCollateralRatio={leverStore.redeemState.collRatio}
          estimatedDebt={leverStore.redeemState.debt}
          virtualRate={modifyPositionData.collateralType.state.codex.virtualRate}
          fairPrice={modifyPositionData.collateralType.state.collybus.fairPrice}
          symbol={modifyPositionData.collateralType.metadata.symbol}
        />
      </Modal.Body>

      <Modal.Footer justify='space-evenly'>
        <Text size={'0.875rem'}>Approve FIAT for Proxy</Text>
        <Switch
          disabled={disableActions || !hasProxy}
          // Next UI Switch `checked` type is wrong, this is necessary
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          checked={() => (modifyPositionData.proxyFIATAllowance?.gt(0) && modifyPositionData.proxyFIATAllowance?.gte(leverStore.redeemState.deltaDebt) ?? false)}
          onChange={async () => {
            if (leverStore.redeemState.deltaDebt.gt(0) && modifyPositionData.proxyFIATAllowance.gte(leverStore.redeemState.deltaDebt)) {
              try {
                setSubmitError('');
                await unsetFIATAllowanceForProxy(contextData.fiat);
              } catch (e: any) {
                setSubmitError(e.message);
              }
            } else {
              try {
                setSubmitError('');
                await setFIATAllowanceForProxy(contextData.fiat, leverStore.redeemState.deltaDebt);
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

        <Spacer y={3} />

        {modifyPositionData.monetaFIATAllowance?.lt(leverStore.redeemState.deltaDebt) && (
          <>
            <Spacer y={3} />
            <Button
              css={{ minWidth: '100%' }}
              disabled={(() => {
                if (disableActions || !hasProxy) return true;
                if (modifyPositionData.monetaFIATAllowance?.gt(0) && modifyPositionData.monetaFIATAllowance?.gte(leverStore.redeemState.deltaDebt)) return true;
                return false;
              })()}
              icon={(['setFIATAllowanceForMoneta'].includes(currentTxAction || '') && disableActions)
                ? (<Loading size='xs' />)
                : null
              }
              onPress={async () => {
                try {
                  setSubmitError('');
                  await setFIATAllowanceForMoneta(contextData.fiat);
                } catch (e: any) {
                  setSubmitError(e.message);
                }
              }}
            >
              Approve FIAT for Moneta (One Time Action)
            </Button>
          </>
        )}

        { renderFormAlerts() }

        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (disableActions || !hasProxy) return true;
            if (leverStore.formErrors.length !== 0 || leverStore.formWarnings.length !== 0) return true;
            if (leverStore.redeemState.deltaCollateral.isZero() && leverStore.redeemState.deltaDebt.isZero()) return true;
            if (!leverStore.redeemState.deltaDebt.isZero() && modifyPositionData.monetaFIATAllowance?.lt(leverStore.redeemState.deltaDebt)) return true;
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
              await redeemCollateralAndModifyDebt(leverStore.redeemState.deltaCollateral, leverStore.redeemState.deltaDebt);
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
