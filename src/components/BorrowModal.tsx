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
import { computeCollateralizationRatio, normalDebtToDebt, scaleToDec, wadToDec } from '@fiatdao/sdk';

import { commifyToDecimalPlaces, floor2, floor5, formatUnixTimestamp } from '../utils';
import { TransactionStatus } from '../../pages';
import { Mode, useBorrowStore } from '../stores/borrowStore';
import { Alert } from './Alert';
import { InputLabelWithMax } from './InputLabelWithMax';
import shallow from 'zustand/shallow';

interface BorrowModalProps {
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

export const BorrowModal = (props: BorrowModalProps) => {
  return (
    <Modal
      preventClose
      closeButton={!props.disableActions}
      blur
      open={props.open}
      onClose={() => props.onClose()}
      width='27rem'
    >
      <BorrowModalBody {...props} />
    </Modal>
  );
};

const BorrowModalBody = (props: BorrowModalProps) => {
  const borrowStore = useBorrowStore();

  const matured = React.useMemo(() => {
    const maturity = props.modifyPositionData.collateralType?.properties.maturity.toString();
    return (maturity !== undefined && !(new Date() < new Date(Number(maturity) * 1000)));
  }, [props.modifyPositionData.collateralType?.properties.maturity])

  React.useEffect(() => {
    if (matured && borrowStore.mode !== 'redeem') {
      borrowStore.setMode(Mode.REDEEM);
    }  
  }, [borrowStore, matured, props.contextData.fiat, props.modifyPositionData])

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
          <Text b size={16}>{`${props.modifyPositionData.collateralType.metadata.protocol} - ${props.modifyPositionData.collateralType.metadata.asset}`}</Text>
          <br />
          <Text b size={14}>{`${formatUnixTimestamp(props.modifyPositionData.collateralType?.properties.maturity)}`}</Text>
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
                  isActive={borrowStore.mode === Mode.INCREASE}
                  onClick={() => {
                    if (props.disableActions) return;
                    borrowStore.setMode(Mode.INCREASE);
                  }}
                >
                  Increase
                </Navbar.Link>
                <Navbar.Link
                  isDisabled={props.disableActions}
                  isActive={borrowStore.mode === Mode.DECREASE}
                  onClick={() => {
                    if (props.disableActions) return;
                    borrowStore.setMode(Mode.DECREASE);
                  }}
                >
                  Decrease
                </Navbar.Link>
              </>
            )}
            {matured && (
              <Navbar.Link
                isDisabled={props.disableActions || !matured}
                isActive={borrowStore.mode === Mode.REDEEM}
                onClick={() => {
                  borrowStore.setMode(Mode.REDEEM);
                }}
              >
                Redeem
              </Navbar.Link>
            )}
          </Navbar.Content>
        </Navbar>
      </Modal.Body>

      {
        borrowStore.mode === Mode.INCREASE
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
        : borrowStore.mode === Mode.DECREASE
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
        : borrowStore.mode === Mode.REDEEM
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

  const hasProxy = contextData.proxies.length > 0;
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
            borrowStore.increaseActions.setUnderlier(contextData.fiat, event.target.value, modifyPositionData);
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
            borrowStore.increaseActions.setSlippagePct(contextData.fiat, event.target.value, modifyPositionData);
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
          borrowStore.increaseActions.setDeltaDebt(contextData.fiat, event.target.value,modifyPositionData);
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
                await unsetUnderlierAllowanceForProxy(contextData.fiat);
              } catch (e: any) {
                setSubmitError(e.message);
              }
            } else {
              try {
                setSubmitError('');
                await setUnderlierAllowanceForProxy(contextData.fiat, borrowStore.increaseState.underlier)
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

  const hasProxy = contextData.proxies.length > 0;
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
            value={floor2(wadToDec(borrowStore.decreaseState.deltaCollateral))}
            onChange={(event) => {
              borrowStore.decreaseActions.setDeltaCollateral(contextData.fiat, event.target.value, modifyPositionData);
            }}
            placeholder='0'
            inputMode='decimal'
            // Bypass type warning from passing a custom component instead of a string
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            label={
              <InputLabelWithMax
                label='Collateral to withdraw and swap'
                onMaxClick={() => borrowStore.decreaseActions.setMaxDeltaCollateral(contextData.fiat, modifyPositionData)}
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
              borrowStore.decreaseActions.setSlippagePct(contextData.fiat, event.target.value, modifyPositionData);
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
            borrowStore.decreaseActions.setDeltaDebt(contextData.fiat, event.target.value,modifyPositionData);
          }}
          placeholder='0'
          inputMode='decimal'
          // Bypass type warning from passing a custom component instead of a string
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          label={
            <InputLabelWithMax
              label='FIAT to pay back'
              onMaxClick={() => borrowStore.decreaseActions.setMaxDeltaDebt(contextData.fiat, modifyPositionData)}
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
                await unsetFIATAllowanceForProxy(contextData.fiat);
              } catch (e: any) {
                setSubmitError(e.message);
              }
            } else {
              try {
                setSubmitError('');
                await setFIATAllowanceForProxy(contextData.fiat, borrowStore.decreaseState.deltaDebt);
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

  const hasProxy = contextData.proxies.length > 0;
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
            value={floor2(wadToDec(borrowStore.redeemState.deltaCollateral))}
            onChange={(event) => {
              borrowStore.redeemActions.setDeltaCollateral(contextData.fiat, event.target.value, modifyPositionData);
            }}
            placeholder='0'
            inputMode='decimal'
            // Bypass type warning from passing a custom component instead of a string
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            label={<InputLabelWithMax label='Collateral to withdraw and redeem' onMaxClick={() => borrowStore.redeemActions.setMaxDeltaCollateral(contextData.fiat, modifyPositionData)} /> }
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
            borrowStore.redeemActions.setDeltaDebt(contextData.fiat, event.target.value,modifyPositionData);
          }}
          placeholder='0'
          inputMode='decimal'
          // Bypass type warning from passing a custom component instead of a string
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          label={<InputLabelWithMax label='FIAT to pay back' onMaxClick={() => borrowStore.redeemActions.setMaxDeltaDebt(contextData.fiat, modifyPositionData)} />}
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
                await unsetFIATAllowanceForProxy(contextData.fiat);
              } catch (e: any) {
                setSubmitError(e.message);
              }
            } else {
              try {
                setSubmitError('');
                await setFIATAllowanceForProxy(contextData.fiat, borrowStore.redeemState.deltaDebt);
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

const PositionPreview = ({
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
          : `${floor5(wadToDec(normalDebtToDebt(positionNormalDebt, virtualRate)))} → ${floor5(wadToDec(estimatedDebt))}`
        }
        placeholder='0'
        type='string'
        label={`Debt (before: ${floor5(wadToDec(normalDebtToDebt(positionNormalDebt, virtualRate)))} FIAT)`}
        labelRight={'FIAT'}
        contentLeft={formDataLoading ? <Loading size='xs' /> : null}
        size='sm'
        status='primary'
      />
      <Input
        readOnly
        value={(() => {
          if (formDataLoading) return ' ';
          let collRatioBefore = computeCollateralizationRatio(
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
          const collRatio = computeCollateralizationRatio(
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
