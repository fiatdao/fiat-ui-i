import React from 'react';
import {
  Button,
  Card,
  Grid,
  Input,
  Loading,
  Modal,
  Navbar,
  Spacer,
  Switch,
  Text,
} from '@nextui-org/react';
import { BigNumber, ethers } from 'ethers';
import { scaleToDec, wadToDec } from '@fiatdao/sdk';

import { commifyToDecimalPlaces, floor2, floor5, formatUnixTimestamp } from '../utils';
import { TransactionStatus } from '../../pages';
import { Mode, useModifyPositionStore } from '../stores/modifyPositionStore';
import { Alert } from './Alert';
import { InputLabelWithMax } from './InputLabelWithMax';
import shallow from 'zustand/shallow';

interface ModifyPositionModalProps {
  buyCollateralAndModifyDebt: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any;
  sellCollateralAndModifyDebt: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any;
  redeemCollateralAndModifyDebt: (deltaCollateral: BigNumber, deltaDebt: BigNumber) => any;
  setFIATAllowanceForMoneta: (fiat: any) => any;
  setFIATAllowanceForProxy: (fiat: any, amount: BigNumber) => any;
  unsetFIATAllowanceForProxy: (fiat: any) => any;
  setUnderlierAllowanceForProxy: (fiat: any, amount: BigNumber) => any;
  unsetUnderlierAllowanceForProxy: (fiat: any) => any;
  setTransactionStatus: (status: TransactionStatus) => void;
  contextData: any;
  disableActions: boolean;
  modifyPositionData: any;
  transactionData: any;
  open: boolean;
  onClose: () => void;
}

export const ModifyPositionModal = (props: ModifyPositionModalProps) => {
  return (
    <Modal
      preventClose
      closeButton={!props.disableActions}
      blur
      open={props.open}
      onClose={() => props.onClose()}
      width='27rem'
    >
      <ModifyPositionModalBody {...props} />
    </Modal>
  );
};

const ModifyPositionModalBody = (props: ModifyPositionModalProps) => {
  const modifyPositionStore = useModifyPositionStore();

  const matured = React.useMemo(() => {
    const maturity = props.modifyPositionData.collateralType?.properties.maturity.toString();
    return (maturity !== undefined && !(new Date() < new Date(Number(maturity) * 1000)));
  }, [props.modifyPositionData.collateralType?.properties.maturity])

  React.useEffect(() => {
    if (matured && modifyPositionStore.mode !== 'redeem') {
      modifyPositionStore.setMode(Mode.REDEEM);
    }  
  }, [modifyPositionStore, matured, props.contextData.fiat, props.modifyPositionData])

  if (!props.contextData.user || !props.modifyPositionData.collateralType || !props.modifyPositionData.collateralType.metadata ) {
    // TODO: add skeleton components instead of loading
    // return <Loading />;
    return null;
  }

  return (
    <>
      <Modal.Header>
        <Text id='modal-title' size={18}>
          <Text b size={18}>
            Modify Position
          </Text>
          <br />
          <Text b size={16}>{`${props.modifyPositionData.protocol} - ${props.modifyPositionData.asset}`}</Text>
          <br />
          <Text b size={14}>{`${formatUnixTimestamp(props.modifyPositionData.maturity)}`}</Text>
        </Text>
      </Modal.Header>
      <Modal.Body>
        <Navbar
          variant='static'
          isCompact
          disableShadow
          disableBlur
          containerCss={{ justifyContent: 'center', background: 'transparent' }}
        >
          <Navbar.Content enableCursorHighlight variant='highlight-rounded'>
            {!matured && (
              <>
                <Navbar.Link
                  isDisabled={props.disableActions}
                  isActive={modifyPositionStore.mode === Mode.INCREASE}
                  onClick={() => {
                    if (props.disableActions) return;
                    modifyPositionStore.setMode(Mode.INCREASE);
                  }}
                >
                  Increase
                </Navbar.Link>
                <Navbar.Link
                  isDisabled={props.disableActions}
                  isActive={modifyPositionStore.mode === Mode.DECREASE}
                  onClick={() => {
                    if (props.disableActions) return;
                    modifyPositionStore.setMode(Mode.DECREASE);
                  }}
                >
                  Decrease
                </Navbar.Link>
              </>
            )}
            {matured && (
              <Navbar.Link
                isDisabled={props.disableActions || !matured}
                isActive={modifyPositionStore.mode === Mode.REDEEM}
                onClick={() => {
                  modifyPositionStore.setMode(Mode.REDEEM);
                }}
              >
                Redeem
              </Navbar.Link>
            )}
          </Navbar.Content>
        </Navbar>
      </Modal.Body>

      {
        modifyPositionStore.mode === Mode.INCREASE
        ? <IncreaseForm
            contextData={props.contextData}
            disableActions={props.disableActions}
            modifyPositionData={props.modifyPositionData}
            transactionData={props.transactionData}
            onClose={props.onClose}
            buyCollateralAndModifyDebt={props.buyCollateralAndModifyDebt}
            setUnderlierAllowanceForProxy={props.setUnderlierAllowanceForProxy}
            unsetUnderlierAllowanceForProxy={props.unsetUnderlierAllowanceForProxy}
            
          />
        : modifyPositionStore.mode === Mode.DECREASE
        ? <DecreaseForm
            contextData={props.contextData}
            disableActions={props.disableActions}
            modifyPositionData={props.modifyPositionData}
            transactionData={props.transactionData}
            onClose={props.onClose}
            setFIATAllowanceForProxy={props.setFIATAllowanceForProxy}
            unsetFIATAllowanceForProxy={props.unsetFIATAllowanceForProxy}
            setFIATAllowanceForMoneta={props.setFIATAllowanceForMoneta}
            sellCollateralAndModifyDebt={props.sellCollateralAndModifyDebt}
          />
        : modifyPositionStore.mode === Mode.REDEEM
        ? <RedeemForm
            contextData={props.contextData}
            disableActions={props.disableActions}
            modifyPositionData={props.modifyPositionData}
            transactionData={props.transactionData}
            onClose={props.onClose}
            setFIATAllowanceForProxy={props.setFIATAllowanceForProxy}
            unsetFIATAllowanceForProxy={props.unsetFIATAllowanceForProxy}
            setFIATAllowanceForMoneta={props.setFIATAllowanceForMoneta}
            redeemCollateralAndModifyDebt={props.redeemCollateralAndModifyDebt}
          />
        : null
      }
    </>
  );
};

const IncreaseForm = ({
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
  const modifyPositionStore = useModifyPositionStore(
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

    if (modifyPositionStore.formWarnings.length !== 0) {
      modifyPositionStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (modifyPositionStore.formErrors.length !== 0) {
      modifyPositionStore.formErrors.forEach((formError, idx) => {
        formAlerts.push(<Alert severity='error' message={formError} key={`err-${idx}`} />);
      });
    }

    if (submitError !== '' && submitError !== 'ACTION_REJECTED') {
      formAlerts.push(<Alert severity='error' message={submitError} />);
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
          Wallet: {commifyToDecimalPlaces(modifyPositionData.underlierBalance, modifyPositionData.collateralType.properties.underlierScale, 2)} {modifyPositionData.collateralType.metadata.underlierSymbol}
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
          value={floor2(scaleToDec(modifyPositionStore.increaseState.underlier, modifyPositionData.collateralType.properties.underlierScale))}
          onChange={(event) => {
            modifyPositionStore.increaseActions.setUnderlier(contextData.fiat, event.target.value, modifyPositionData);
          }}
          placeholder='0'
          inputMode='decimal'
          labelRight={modifyPositionData.collateralType.metadata.underlierSymbol}
          bordered
          size='sm'
          borderWeight='light'
          width='15rem'
        />
        <Input
          disabled={disableActions}
          value={floor2(Number(wadToDec(modifyPositionStore.increaseState.slippagePct)) * 100)}
          onChange={(event) => {
            modifyPositionStore.increaseActions.setSlippagePct(contextData.fiat, event.target.value, modifyPositionData);
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
        value={floor5(wadToDec(modifyPositionStore.increaseState.deltaDebt))}
        onChange={(event) => {
          modifyPositionStore.increaseActions.setDeltaDebt(contextData.fiat, event.target.value,modifyPositionData);
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
            modifyPositionStore.formDataLoading
              ? ' '
              : floor2(wadToDec(modifyPositionStore.increaseState.deltaCollateral))
          }
          placeholder='0'
          type='string'
          label={'Collateral to deposit (incl. slippage)'}
          labelRight={modifyPositionData.collateralType.metadata.symbol}
          contentLeft={modifyPositionStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body css={{ marginTop: 'var(--nextui-space-8)' }}>
        <PositionPreview
          fiat={contextData.fiat}
          formDataLoading={modifyPositionStore.formDataLoading}
          positionCollateral={modifyPositionData.position.collateral}
          positionNormalDebt={modifyPositionData.position.normalDebt}
          estimatedCollateral={modifyPositionStore.increaseState.collateral}
          estimatedCollateralRatio={modifyPositionStore.increaseState.collRatio}
          estimatedDebt={modifyPositionStore.increaseState.debt}
          virtualRate={modifyPositionData.collateralType.state.codex.virtualRate}
          fairPrice={modifyPositionData.collateralType.state.collybus.fairPrice}
          symbol={modifyPositionData.collateralType.metadata.symbol}
        />
      </Modal.Body>

      <Modal.Footer justify='space-evenly'>
        <>
          <Text size={'0.875rem'}>Approve {modifyPositionData.collateralType.metadata.underlierSymbol}</Text>
          <Switch
            disabled={disableActions || !hasProxy}
            // Next UI Switch `checked` type is wrong, this is necessary
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            checked={() => modifyPositionData.underlierAllowance?.gt(0) && modifyPositionData.underlierAllowance?.gte(modifyPositionStore.increaseState.underlier) ?? false}
            onChange={async () => {
              if(!modifyPositionStore.increaseState.underlier.isZero() && modifyPositionData.underlierAllowance.gte(modifyPositionStore.increaseState.underlier)) {
                try {
                  setSubmitError('');
                  await unsetUnderlierAllowanceForProxy(contextData.fiat);
                } catch (e: any) {
                  setSubmitError(e.message);
                }
              } else {
                try {
                  setSubmitError('');
                  await setUnderlierAllowanceForProxy(contextData.fiat, modifyPositionStore.increaseState.underlier)
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
        </>
        { renderFormAlerts() }
        <Spacer y={3} />
        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (disableActions || !hasProxy) return true;
            if (modifyPositionStore.formErrors.length !== 0 || modifyPositionStore.formWarnings.length !== 0) return true;
            if (modifyPositionData.monetaDelegate === false) return true;
            if (modifyPositionStore.increaseState.underlier.isZero() && modifyPositionStore.increaseState.deltaDebt.isZero()) return true;
            if (!modifyPositionStore.increaseState.underlier.isZero() && modifyPositionData.underlierAllowance.lt(modifyPositionStore.increaseState.underlier)) return true;
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
              await buyCollateralAndModifyDebt(modifyPositionStore.increaseState.deltaCollateral, modifyPositionStore.increaseState.deltaDebt, modifyPositionStore.increaseState.underlier);
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

const DecreaseForm = ({
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
  // TODO: select decrease state & actions off store
  const modifyPositionStore = useModifyPositionStore();

  const hasProxy = contextData.proxies.length > 0;
  const { action: currentTxAction } = transactionData;
  
  const renderFormAlerts = () => {
    const formAlerts = [];

    if (modifyPositionStore.formWarnings.length !== 0) {
      modifyPositionStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (modifyPositionStore.formErrors.length !== 0) {
      modifyPositionStore.formErrors.forEach((formError, idx) => {
        formAlerts.push(<Alert severity='error' message={formError} key={`err-${idx}`} />);
      });
    }

    if (submitError !== '' && submitError !== 'ACTION_REJECTED') {
      formAlerts.push(<Alert severity='error' message={submitError} />);
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
            value={floor2(wadToDec(modifyPositionStore.decreaseState.deltaCollateral))}
            onChange={(event) => {
              modifyPositionStore.decreaseActions.setDeltaCollateral(contextData.fiat, event.target.value, modifyPositionData);
            }}
            placeholder='0'
            inputMode='decimal'
            // Bypass type warning from passing a custom component instead of a string
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            label={
              <InputLabelWithMax
                label='Collateral to withdraw and swap'
                onMaxClick={() => modifyPositionStore.decreaseActions.setMaxDeltaCollateral(contextData.fiat, modifyPositionData)}
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
            value={floor2(Number(wadToDec(modifyPositionStore.decreaseState.slippagePct)) * 100)}
            onChange={(event) => {
              modifyPositionStore.decreaseActions.setSlippagePct(contextData.fiat, event.target.value, modifyPositionData);
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
          value={floor5(wadToDec(modifyPositionStore.decreaseState.deltaDebt))}
          onChange={(event) => {
            modifyPositionStore.decreaseActions.setDeltaDebt(contextData.fiat, event.target.value,modifyPositionData);
          }}
          placeholder='0'
          inputMode='decimal'
          // Bypass type warning from passing a custom component instead of a string
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          label={
            <InputLabelWithMax
              label='FIAT to pay back'
              onMaxClick={() => modifyPositionStore.decreaseActions.setMaxDeltaDebt(contextData.fiat, modifyPositionData)}
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
            (modifyPositionStore.formDataLoading)
              ? ' '
              : floor2(scaleToDec(modifyPositionStore.decreaseState.underlier, modifyPositionData.collateralType.properties.underlierScale))
          }
          placeholder='0'
          type='string'
          label={'Underliers to withdraw (incl. slippage)'}
          labelRight={modifyPositionData.collateralType.metadata.underlierSymbol}
          contentLeft={modifyPositionStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Body css={{ marginTop: 'var(--nextui-space-8)' }}>
        <PositionPreview
          fiat={contextData.fiat}
          formDataLoading={modifyPositionStore.formDataLoading}
          positionCollateral={modifyPositionData.position.collateral}
          positionNormalDebt={modifyPositionData.position.normalDebt}
          estimatedCollateral={modifyPositionStore.decreaseState.collateral}
          estimatedCollateralRatio={modifyPositionStore.decreaseState.collRatio}
          estimatedDebt={modifyPositionStore.decreaseState.debt}
          virtualRate={modifyPositionData.collateralType.state.codex.virtualRate}
          fairPrice={modifyPositionData.collateralType.state.collybus.fairPrice}
          symbol={modifyPositionData.collateralType.metadata.symbol}
        />
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Footer justify='space-evenly'>
        <>
          <Text size={'0.875rem'}>Approve FIAT for Proxy</Text>
          <Switch
            disabled={disableActions || !hasProxy}
            // Next UI Switch `checked` type is wrong, this is necessary
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            checked={() => modifyPositionData.proxyFIATAllowance?.gt(0) && modifyPositionData.proxyFIATAllowance?.gte(modifyPositionStore.decreaseState.deltaDebt) ?? false}
            onChange={async () => {
              if (modifyPositionStore.decreaseState.deltaDebt.gt(0) && modifyPositionData.proxyFIATAllowance.gte(modifyPositionStore.decreaseState.deltaDebt)) {
                try {
                  setSubmitError('');
                  await unsetFIATAllowanceForProxy(contextData.fiat);
                } catch (e: any) {
                  setSubmitError(e.message);
                }
              } else {
                try {
                  setSubmitError('');
                  await setFIATAllowanceForProxy(contextData.fiat, modifyPositionStore.decreaseState.deltaDebt);
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
          {modifyPositionData.monetaFIATAllowance?.lt(modifyPositionStore.decreaseState.deltaDebt) && (
            <>
              <Spacer y={3} />
              <Button
                css={{ minWidth: '100%' }}
                disabled={(() => {
                  if (disableActions || !hasProxy) return true;
                  if (modifyPositionData.monetaFIATAllowance?.gt(0) && modifyPositionData.monetaFIATAllowance?.gte(modifyPositionStore.decreaseState.deltaDebt)) return true;
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
        </>
        { renderFormAlerts() }
        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (disableActions || !hasProxy) return true;
            if (modifyPositionStore.formErrors.length !== 0 || modifyPositionStore.formWarnings.length !== 0) return true;
            if (modifyPositionStore.decreaseState.deltaCollateral.isZero() && modifyPositionStore.decreaseState.deltaDebt.isZero()) return true;
            if (!modifyPositionStore.decreaseState.deltaDebt.isZero() && modifyPositionData.monetaFIATAllowance?.lt(modifyPositionStore.decreaseState.deltaDebt)) return true;
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
              await sellCollateralAndModifyDebt(modifyPositionStore.decreaseState.deltaCollateral, modifyPositionStore.decreaseState.deltaDebt, modifyPositionStore.decreaseState.underlier);
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

const RedeemForm = ({
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
  // TODO: select redeem state & actions off store
  const modifyPositionStore = useModifyPositionStore();

  const hasProxy = contextData.proxies.length > 0;
  const { action: currentTxAction } = transactionData;
  
  const renderFormAlerts = () => {
    const formAlerts = [];

    if (modifyPositionStore.formWarnings.length !== 0) {
      modifyPositionStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (modifyPositionStore.formErrors.length !== 0) {
      modifyPositionStore.formErrors.forEach((formError, idx) => {
        formAlerts.push(<Alert severity='error' message={formError} key={`err-${idx}`} />);
      });
    }

    if (submitError !== '' && submitError !== 'ACTION_REJECTED') {
      formAlerts.push(<Alert severity='error' message={submitError} />);
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
            value={floor2(wadToDec(modifyPositionStore.redeemState.deltaCollateral))}
            onChange={(event) => {
              modifyPositionStore.redeemActions.setDeltaCollateral(contextData.fiat, event.target.value, modifyPositionData);
            }}
            placeholder='0'
            inputMode='decimal'
            // Bypass type warning from passing a custom component instead of a string
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            label={<InputLabelWithMax label='Collateral to withdraw and redeem' onMaxClick={() => modifyPositionStore.redeemActions.setMaxDeltaCollateral(contextData.fiat, modifyPositionData)} /> }
            labelRight={modifyPositionData.collateralType.metadata.symbol}
            bordered
            size='sm'
            borderWeight='light'
            width={'100%'}
          />
        </Grid.Container>
        <Input
          disabled={disableActions}
          value={floor5(wadToDec(modifyPositionStore.redeemState.deltaDebt))}
          onChange={(event) => {
            modifyPositionStore.redeemActions.setDeltaDebt(contextData.fiat, event.target.value,modifyPositionData);
          }}
          placeholder='0'
          inputMode='decimal'
          // Bypass type warning from passing a custom component instead of a string
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          label={<InputLabelWithMax label='FIAT to pay back' onMaxClick={() => modifyPositionStore.redeemActions.setMaxDeltaDebt(contextData.fiat, modifyPositionData)} />}
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
          fiat={contextData.fiat}
          formDataLoading={modifyPositionStore.formDataLoading}
          positionCollateral={modifyPositionData.position.collateral}
          positionNormalDebt={modifyPositionData.position.normalDebt}
          estimatedCollateral={modifyPositionStore.redeemState.collateral}
          estimatedCollateralRatio={modifyPositionStore.redeemState.collRatio}
          estimatedDebt={modifyPositionStore.redeemState.debt}
          virtualRate={modifyPositionData.collateralType.state.codex.virtualRate}
          fairPrice={modifyPositionData.collateralType.state.collybus.fairPrice}
          symbol={modifyPositionData.collateralType.metadata.symbol}
        />
      </Modal.Body>

      <Spacer y={0.75} />
      <Card.Divider />

      <Modal.Footer justify='space-evenly'>
        <Text size={'0.875rem'}>Approve FIAT for Proxy</Text>
        <Switch
          disabled={disableActions || !hasProxy}
          // Next UI Switch `checked` type is wrong, this is necessary
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          checked={() => modifyPositionData.proxyFIATAllowance?.gt(0) && modifyPositionData.proxyFIATAllowance?.gte(modifyPositionStore.redeemState.deltaDebt) ?? false}
          onChange={async () => {
            if (modifyPositionStore.redeemState.deltaDebt.gt(0) && modifyPositionData.proxyFIATAllowance.gte(modifyPositionStore.redeemState.deltaDebt)) {
              try {
                setSubmitError('');
                await unsetFIATAllowanceForProxy(contextData.fiat);
              } catch (e: any) {
                setSubmitError(e.message);
              }
            } else {
              try {
                setSubmitError('');
                await setFIATAllowanceForProxy(contextData.fiat, modifyPositionStore.redeemState.deltaDebt);
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
        {modifyPositionData.monetaFIATAllowance?.lt(modifyPositionStore.redeemState.deltaDebt) && (
          <>
            <Spacer y={3} />
            <Button
              css={{ minWidth: '100%' }}
              disabled={(() => {
                if (disableActions || !hasProxy) return true;
                if (modifyPositionData.monetaFIATAllowance?.gt(0) && modifyPositionData.monetaFIATAllowance?.gte(modifyPositionStore.redeemState.deltaDebt)) return true;
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
            if (modifyPositionStore.formErrors.length !== 0 || modifyPositionStore.formWarnings.length !== 0) return true;
            if (modifyPositionStore.redeemState.deltaCollateral.isZero() && modifyPositionStore.redeemState.deltaDebt.isZero()) return true;
            if (!modifyPositionStore.redeemState.deltaDebt.isZero() && modifyPositionData.monetaFIATAllowance?.lt(modifyPositionStore.redeemState.deltaDebt)) return true;
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
              await redeemCollateralAndModifyDebt(modifyPositionStore.redeemState.deltaCollateral, modifyPositionStore.redeemState.deltaDebt);
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

const PositionPreview = ({
  fiat,
  formDataLoading,
  positionCollateral,
  positionNormalDebt,
  estimatedCollateral,
  estimatedCollateralRatio,
  estimatedDebt,
  virtualRate,
  fairPrice,
  symbol,
}: {
  fiat: any,
  formDataLoading: boolean,
  positionCollateral: BigNumber,
  positionNormalDebt: BigNumber,
  estimatedCollateral: BigNumber,
  estimatedCollateralRatio: BigNumber,
  estimatedDebt: BigNumber,
  virtualRate: BigNumber,
  fairPrice: BigNumber,
  symbol: string,
}) => {
  return (
    <>
      <Text b size={'m'}>
        Position Preview
      </Text>
      <Input
        readOnly
        value={(formDataLoading)
          ? ' '
          : `${floor2(wadToDec(positionCollateral))} → ${floor2(wadToDec(estimatedCollateral))}`
        }
        placeholder='0'
        type='string'
        label={`Collateral (before: ${floor2(wadToDec(positionCollateral))} ${symbol})`}
        labelRight={symbol}
        contentLeft={formDataLoading ? <Loading size='xs' /> : null}
        size='sm'
        status='primary'
      />
      <Input
        readOnly
        value={(formDataLoading)
          ? ' '
          : `${floor5(wadToDec(fiat.normalDebtToDebt(positionNormalDebt, virtualRate)))} → ${floor5(wadToDec(estimatedDebt))}`
        }
        placeholder='0'
        type='string'
        label={`Debt (before: ${floor5(wadToDec(fiat.normalDebtToDebt(positionNormalDebt, virtualRate)))} FIAT)`}
        labelRight={'FIAT'}
        contentLeft={formDataLoading ? <Loading size='xs' /> : null}
        size='sm'
        status='primary'
      />
      <Input
        readOnly
        value={(() => {
          if (formDataLoading) return ' ';
          let collRatioBefore = fiat.computeCollateralizationRatio(
            positionCollateral, fairPrice, positionNormalDebt, virtualRate
          );
          collRatioBefore = (collRatioBefore.eq(ethers.constants.MaxUint256))
            ? '∞' : `${floor2(wadToDec(collRatioBefore.mul(100)))}%`;
            const collRatioAfter = (estimatedCollateralRatio.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(estimatedCollateralRatio.mul(100)))}%`;
              return `${collRatioBefore} → ${collRatioAfter}`;
        })()}
        placeholder='0'
        type='string'
        label={
          `Collateralization Ratio (before: ${(() => {
          const collRatio = fiat.computeCollateralizationRatio(
            positionCollateral, fairPrice, positionNormalDebt, virtualRate
          );
          if (collRatio.eq(ethers.constants.MaxUint256)) return '∞'
            return floor2(wadToDec(collRatio.mul(100)));
        })()
        }%)`
        }
        labelRight={'🚦'}
        contentLeft={formDataLoading ? <Loading size='xs' /> : null}
        size='sm'
        status='primary'
      />
    </>
  );
}
