import { scaleToDec, wadToDec } from '@fiatdao/sdk';
import { Button, Card, Grid, Input, Loading, Modal, Spacer, Switch, Text } from '@nextui-org/react';
import { Slider } from 'antd';
import 'antd/dist/antd.css';
import { BigNumber, ethers } from 'ethers';
import React, {useMemo} from 'react';
import { chain as chains, useAccount, useNetwork } from 'wagmi';
import shallow from 'zustand/shallow';
import { useUserData } from '../../state/queries/useUserData';
import { useBorrowStore } from '../../state/stores/borrowStore';
import { commifyToDecimalPlaces, floor2, floor4, floor5, minCollRatioWithBuffer } from '../../utils';
import { Alert } from '../Alert';
import { InputLabelWithMax } from '../InputLabelWithMax';
import { PositionPreview } from './PositionPreview';
import useStore from '../../state/stores/globalStore';

export const CreateForm = ({
  disableActions,
  modifyPositionData,
  transactionData,
  onClose,
  // TODO: refactor out into react query mutations / store actions
  createPosition,
  setUnderlierAllowanceForProxy,
  unsetUnderlierAllowanceForProxy,
}: {
  disableActions: boolean,
  modifyPositionData: any,
  transactionData: any,
  onClose: () => void,
  // TODO: refactor out into react query mutations / store actions
  createPosition: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any;
  setUnderlierAllowanceForProxy: (fiat: any, amount: BigNumber) => any,
  unsetUnderlierAllowanceForProxy: (fiat: any) => any,
}) => {
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
  const { action: currentTxAction } = transactionData;

  const fiat = useStore(state => state.fiat);

  const { chain } = useNetwork();
  const { address } = useAccount();
  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const hasProxy = userData.proxies.length > 0;

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
            <Input
              disabled={disableActions}
              value={floor2(scaleToDec(borrowStore.createState.underlier, underlierScale))}
              onChange={(event) => {
                borrowStore.createActions.setUnderlier(
                  fiat, event.target.value, modifyPositionData);
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
              value={floor2(Number(wadToDec(borrowStore.createState.slippagePct)) * 100)}
              onChange={(event) => {
                borrowStore.createActions.setSlippagePct(fiat, event.target.value, modifyPositionData);
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
          Targeted collateralization ratio ({floor2(wadToDec(borrowStore.createState.targetedCollRatio.mul(100)))}%)
        </Text>
        <Card variant='bordered' borderWeight='light' style={{height:'100%'}}>
          <Card.Body
            style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem', overflow: 'hidden' }}
          >
            <Slider
              handleStyle={{ borderColor: '#0072F5' }}
              included={false}
              disabled={disableActions}
              value={Number(wadToDec(borrowStore.createState.targetedCollRatio))}
              onChange={(value) => {
                borrowStore.createActions.setTargetedCollRatio(fiat, value, modifyPositionData);
              }}
              min={floor4(wadToDec(minCollRatio))}
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
              [floor4(wadToDec(minCollRatio))]: {
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
        <Text size={'0.875rem'}>Approve {underlierSymbol}</Text>
        <Switch
          disabled={disableActions || !hasProxy}
          // Next UI Switch `checked` type is wrong, this is necessary
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          checked={() => underlierAllowance?.gt(0) && underlierAllowance?.gte(borrowStore.createState.underlier) ?? false}
          onChange={async () => {
            if (!borrowStore.createState.underlier.isZero() && underlierAllowance?.gte(borrowStore.createState.underlier)) {
              try {
                setSubmitError('');
                await unsetUnderlierAllowanceForProxy(fiat);
              } catch (e: any) {
                setSubmitError(e.message);
              }
            } else {
              try {
                setSubmitError('');
                await setUnderlierAllowanceForProxy(fiat, borrowStore.createState.underlier);
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
            borrowStore.formErrors.length !== 0 ||
            borrowStore.formWarnings.length !== 0 ||
            disableActions ||
            !hasProxy ||
            borrowStore.createState.underlier?.isZero() ||
            borrowStore.createState.deltaCollateral?.isZero() ||
            underlierAllowance?.lt(borrowStore.createState.underlier) ||
            monetaDelegate === false
          }
          icon={(disableActions && currentTxAction === 'createPosition') ? (<Loading size='xs' />) : null}
          onPress={async () => {
            try {
              setSubmitError('');
              await createPosition(
                borrowStore.createState.deltaCollateral, borrowStore.createState.deltaDebt, borrowStore.createState.underlier
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
  disableActions,
  modifyPositionData,
  transactionData,
  onClose,
  // TODO: refactor out into react query mutations / store actions
  buyCollateralAndModifyDebt,
  setUnderlierAllowanceForProxy,
  unsetUnderlierAllowanceForProxy,
}: {
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

  const { chain } = useNetwork();
  const { address } = useAccount();
  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const hasProxy = userData.proxies.length > 0;
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
        <Input
          label={'Underlier to deposit'}
          disabled={disableActions}
          value={floor2(scaleToDec(borrowStore.increaseState.underlier, modifyPositionData.collateralType.properties.underlierScale))}
          onChange={(event) => {
            borrowStore.increaseActions.setUnderlier(fiat, event.target.value, modifyPositionData);
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
          value={floor2(Number(wadToDec(borrowStore.increaseState.slippagePct)) * 100)}
          onChange={(event) => {
            borrowStore.increaseActions.setSlippagePct(fiat, event.target.value, modifyPositionData);
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
        value={floor5(wadToDec(borrowStore.increaseState.deltaDebt))}
        onChange={(event) => {
          borrowStore.increaseActions.setDeltaDebt(fiat, event.target.value,modifyPositionData);
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
        <Text size={'0.875rem'}>Approve {modifyPositionData.collateralType.properties.underlierSymbol}</Text>
        <Switch
          disabled={disableActions || !hasProxy}
          // Next UI Switch `checked` type is wrong, this is necessary
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          checked={() => modifyPositionData.underlierAllowance?.gt(0) && modifyPositionData.underlierAllowance?.gte(borrowStore.increaseState.underlier) ?? false}
          onChange={async () => {
            if(!borrowStore.increaseState.underlier.isZero() && modifyPositionData.underlierAllowance.gte(borrowStore.increaseState.underlier)) {
              try {
                setSubmitError('');
                await unsetUnderlierAllowanceForProxy(fiat);
              } catch (e: any) {
                setSubmitError(e.message);
              }
            } else {
              try {
                setSubmitError('');
                await setUnderlierAllowanceForProxy(fiat, borrowStore.increaseState.underlier)
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
            if (borrowStore.formErrors.length !== 0 || borrowStore.formWarnings.length !== 0) return true;
            if (modifyPositionData.monetaDelegate === false) return true;
            if (borrowStore.increaseState.underlier.isZero() && borrowStore.increaseState.deltaDebt.isZero()) return true;
            if (!borrowStore.increaseState.underlier.isZero() && modifyPositionData.underlierAllowance.lt(borrowStore.increaseState.underlier)) return true;
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
              await buyCollateralAndModifyDebt(borrowStore.increaseState.deltaCollateral, borrowStore.increaseState.deltaDebt, borrowStore.increaseState.underlier);
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

  const { chain } = useNetwork();
  const { address } = useAccount();
  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const hasProxy = userData.proxies.length > 0;

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
          <Input
            disabled={disableActions}
            value={floor2(wadToDec(borrowStore.decreaseState.deltaCollateral))}
            onChange={(event) => {
              borrowStore.decreaseActions.setDeltaCollateral(fiat, event.target.value, modifyPositionData);
            }}
            placeholder='0'
            inputMode='decimal'
            // Bypass type warning from passing a custom component instead of a string
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            label={
              <InputLabelWithMax
                label='Collateral to withdraw and swap'
                onMaxClick={() => borrowStore.decreaseActions.setMaxDeltaCollateral(fiat, modifyPositionData)}
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
            value={floor2(Number(wadToDec(borrowStore.decreaseState.slippagePct)) * 100)}
            onChange={(event) => {
              borrowStore.decreaseActions.setSlippagePct(fiat, event.target.value, modifyPositionData);
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
          value={floor5(wadToDec(borrowStore.decreaseState.deltaDebt))}
          onChange={(event) => {
            borrowStore.decreaseActions.setDeltaDebt(fiat, event.target.value,modifyPositionData);
          }}
          placeholder='0'
          inputMode='decimal'
          // Bypass type warning from passing a custom component instead of a string
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          label={
            <InputLabelWithMax
              label='FIAT to pay back'
              onMaxClick={() => borrowStore.decreaseActions.setMaxDeltaDebt(fiat, modifyPositionData)}
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
        <Text size={'0.875rem'}>Approve FIAT for Proxy</Text>
        <Switch
          disabled={disableActions || !hasProxy}
          // Next UI Switch `checked` type is wrong, this is necessary
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          checked={() => (modifyPositionData.proxyFIATAllowance?.gt(0) && modifyPositionData.proxyFIATAllowance?.gte(borrowStore.decreaseState.deltaDebt) ?? false)}
          onChange={async () => {
            if (borrowStore.decreaseState.deltaDebt.gt(0) && modifyPositionData.proxyFIATAllowance.gte(borrowStore.decreaseState.deltaDebt)) {
              try {
                setSubmitError('');
                await unsetFIATAllowanceForProxy(fiat);
              } catch (e: any) {
                setSubmitError(e.message);
              }
            } else {
              try {
                setSubmitError('');
                await setFIATAllowanceForProxy(fiat, borrowStore.decreaseState.deltaDebt);
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

        {modifyPositionData.monetaFIATAllowance?.lt(borrowStore.decreaseState.deltaDebt) && (
          <>
            <Spacer y={3} />
            <Button
              css={{ minWidth: '100%' }}
              disabled={(() => {
                if (disableActions || !hasProxy) return true;
                if (modifyPositionData.monetaFIATAllowance?.gt(0) && modifyPositionData.monetaFIATAllowance?.gte(borrowStore.decreaseState.deltaDebt)) return true;
                return false;
              })()}
              icon={(['setFIATAllowanceForMoneta'].includes(currentTxAction || '') && disableActions)
                ? (<Loading size='xs' />)
                : null
              }
              onPress={async () => {
                try {
                  setSubmitError('');
                  await setFIATAllowanceForMoneta(fiat);
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
            if (borrowStore.formErrors.length !== 0 || borrowStore.formWarnings.length !== 0) return true;
            if (borrowStore.decreaseState.deltaCollateral.isZero() && borrowStore.decreaseState.deltaDebt.isZero()) return true;
            if (!borrowStore.decreaseState.deltaDebt.isZero() && modifyPositionData.monetaFIATAllowance?.lt(borrowStore.decreaseState.deltaDebt)) return true;
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
              await sellCollateralAndModifyDebt(borrowStore.decreaseState.deltaCollateral, borrowStore.decreaseState.deltaDebt, borrowStore.decreaseState.underlier);
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
  
  const { chain } = useNetwork();
  const { address } = useAccount();
  const { data: userData } = useUserData(fiat, chain?.id ?? chains.mainnet.id, address ?? '');
  const hasProxy = userData.proxies.length > 0;

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
          <Input
            disabled={disableActions}
            value={floor2(wadToDec(borrowStore.redeemState.deltaCollateral))}
            onChange={(event) => {
              borrowStore.redeemActions.setDeltaCollateral(fiat, event.target.value, modifyPositionData);
            }}
            placeholder='0'
            inputMode='decimal'
            // Bypass type warning from passing a custom component instead of a string
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            label={<InputLabelWithMax label='Collateral to withdraw and redeem' onMaxClick={() => borrowStore.redeemActions.setMaxDeltaCollateral(fiat, modifyPositionData)} /> }
            labelRight={modifyPositionData.collateralType.metadata.symbol}
            bordered
            size='sm'
            borderWeight='light'
            width={'100%'}
          />
        </Grid.Container>
        <Input
          disabled={disableActions}
          value={floor5(wadToDec(borrowStore.redeemState.deltaDebt))}
          onChange={(event) => {
            borrowStore.redeemActions.setDeltaDebt(fiat, event.target.value,modifyPositionData);
          }}
          placeholder='0'
          inputMode='decimal'
          // Bypass type warning from passing a custom component instead of a string
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          label={<InputLabelWithMax label='FIAT to pay back' onMaxClick={() => borrowStore.redeemActions.setMaxDeltaDebt(fiat, modifyPositionData)} />}
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
        <Text size={'0.875rem'}>Approve FIAT for Proxy</Text>
        <Switch
          disabled={disableActions || !hasProxy}
          // Next UI Switch `checked` type is wrong, this is necessary
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          checked={() => (modifyPositionData.proxyFIATAllowance?.gt(0) && modifyPositionData.proxyFIATAllowance?.gte(borrowStore.redeemState.deltaDebt) ?? false)}
          onChange={async () => {
            if (borrowStore.redeemState.deltaDebt.gt(0) && modifyPositionData.proxyFIATAllowance.gte(borrowStore.redeemState.deltaDebt)) {
              try {
                setSubmitError('');
                await unsetFIATAllowanceForProxy(fiat);
              } catch (e: any) {
                setSubmitError(e.message);
              }
            } else {
              try {
                setSubmitError('');
                await setFIATAllowanceForProxy(fiat, borrowStore.redeemState.deltaDebt);
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

        {modifyPositionData.monetaFIATAllowance?.lt(borrowStore.redeemState.deltaDebt) && (
          <>
            <Spacer y={3} />
            <Button
              css={{ minWidth: '100%' }}
              disabled={(() => {
                if (disableActions || !hasProxy) return true;
                if (modifyPositionData.monetaFIATAllowance?.gt(0) && modifyPositionData.monetaFIATAllowance?.gte(borrowStore.redeemState.deltaDebt)) return true;
                return false;
              })()}
              icon={(['setFIATAllowanceForMoneta'].includes(currentTxAction || '') && disableActions)
                ? (<Loading size='xs' />)
                : null
              }
              onPress={async () => {
                try {
                  setSubmitError('');
                  await setFIATAllowanceForMoneta(fiat);
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
            if (borrowStore.formErrors.length !== 0 || borrowStore.formWarnings.length !== 0) return true;
            if (borrowStore.redeemState.deltaCollateral.isZero() && borrowStore.redeemState.deltaDebt.isZero()) return true;
            if (!borrowStore.redeemState.deltaDebt.isZero() && modifyPositionData.monetaFIATAllowance?.lt(borrowStore.redeemState.deltaDebt)) return true;
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
              await redeemCollateralAndModifyDebt(borrowStore.redeemState.deltaCollateral, borrowStore.redeemState.deltaDebt);
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
