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

import { commifyToDecimalPlaces, floor2, formatUnixTimestamp } from '../utils';
import { TransactionStatus } from '../../pages';
import { useModifyPositionStore } from '../stores/modifyPositionStore';
import { Alert } from './Alert';
import { InputLabelWithMax } from './InputLabelWithMax';

interface ModifyPositionModalProps {
  buyCollateralAndModifyDebt: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any;
  contextData: any;
  disableActions: boolean;
  modifyPositionData: any;
  redeemCollateralAndModifyDebt: (deltaCollateral: BigNumber, deltaDebt: BigNumber) => any;
  sellCollateralAndModifyDebt: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any;
  setMonetaFIATAllowance: (fiat: any, amount: BigNumber) => any;
  setTransactionStatus: (status: TransactionStatus) => void;
  setMonetaDelegate: (fiat: any) => any;
  setUnderlierAllowance: (fiat: any, amount: BigNumber) => any;
  transactionData: any;
  unsetMonetaFIATAllowance: (fiat: any) => any;
  unsetMonetaDelegate: (fiat: any) => any;
  unsetUnderlierAllowance: (fiat: any) => any;
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
  const [rpcError, setRpcError] = React.useState('');

  const matured = React.useMemo(() => {
    const maturity = props.modifyPositionData.collateralType?.properties.maturity.toString();
    return (maturity !== undefined && !(new Date() < new Date(Number(maturity) * 1000)));
  }, [props.modifyPositionData.collateralType?.properties.maturity])

  React.useEffect(() => {
    if (matured && modifyPositionStore.mode !== 'redeem') {
      modifyPositionStore.setMode('redeem');
    }  
  }, [modifyPositionStore, matured, props.contextData.fiat, props.modifyPositionData])

  if (!props.contextData.user || !props.modifyPositionData.collateralType || !props.modifyPositionData.collateralType.metadata ) {
    // TODO: add skeleton components instead of loading
    // return <Loading />;
    return null;
  }

  const { proxies, fiat } = props.contextData;
  const {
    collateralType: {
      metadata: { symbol: symbol, protocol, asset },
      properties: { underlierScale, underlierSymbol, maturity },
      state: { codex: { virtualRate }, collybus: { fairPrice }}
    },
    underlierAllowance,
    underlierBalance,
    monetaDelegate,
    monetaFIATAllowance,
    position,
  } = props.modifyPositionData;

  const { action: currentTxAction } = props.transactionData;

  const hasProxy = proxies.length > 0;

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

    if (rpcError !== '' && rpcError !== 'ACTION_REJECTED') {
      formAlerts.push(<Alert severity='error' message={rpcError} />);
    }

    return formAlerts;
  }

  return (
    <>
      <Modal.Header>
        <Text id='modal-title' size={18}>
          <Text b size={18}>
            Modify Position
          </Text>
          <br />
          <Text b size={16}>{`${protocol} - ${asset}`}</Text>
          <br />
          <Text b size={14}>{`${formatUnixTimestamp(maturity)}`}</Text>
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
                  isActive={modifyPositionStore.mode === 'deposit'}
                  onClick={() => {
                    if (props.disableActions) return;
                    modifyPositionStore.resetCollateralAndDebtInputs(props.contextData.fiat, props.modifyPositionData);
                    modifyPositionStore.setMode('deposit');
                  }}
                >
                  Increase
                </Navbar.Link>
                <Navbar.Link
                  isDisabled={props.disableActions}
                  isActive={modifyPositionStore.mode === 'withdraw'}
                  onClick={() => {
                    if (props.disableActions) return;
                    modifyPositionStore.resetCollateralAndDebtInputs(props.contextData.fiat, props.modifyPositionData);
                    modifyPositionStore.setMode('withdraw');
                  }}
                >
                  Decrease
                </Navbar.Link>
              </>
            )}
            {matured && (
              <Navbar.Link
                isDisabled={props.disableActions || !matured}
                isActive={modifyPositionStore.mode === 'redeem'}
                onClick={() => {
                  modifyPositionStore.resetCollateralAndDebtInputs(props.contextData.fiat, props.modifyPositionData);
                  modifyPositionStore.setMode('redeem');
                }}
              >
                Redeem
              </Navbar.Link>
            )}
          </Navbar.Content>
        </Navbar>
        <Text b size={'m'}>
          Inputs
        </Text>
        {underlierBalance && modifyPositionStore.mode === 'deposit' && (
          <Text size={'$sm'}>
            Wallet: {commifyToDecimalPlaces(underlierBalance, underlierScale, 2)} {underlierSymbol}
          </Text>
        )}
        <Grid.Container
          gap={0}
          justify='space-between'
          wrap='wrap'
          css={{ marginBottom: '1rem' }}
        >
          {modifyPositionStore.mode === 'deposit' && (
            <Input
              label={'Underlier to deposit'}
              disabled={props.disableActions}
              value={floor2(scaleToDec(modifyPositionStore.underlier, underlierScale))}
              onChange={(event) => {
                modifyPositionStore.setUnderlier(props.contextData.fiat, event.target.value, props.modifyPositionData);
              }}
              placeholder='0'
              inputMode='decimal'
              labelRight={underlierSymbol}
              bordered
              size='sm'
              borderWeight='light'
              width='15rem'
            />
          )}
          {(modifyPositionStore.mode === 'withdraw' || modifyPositionStore.mode === 'redeem') && (
            <Input
              disabled={props.disableActions}
              value={floor2(wadToDec(modifyPositionStore.deltaCollateral))}
              onChange={(event) => {
                modifyPositionStore.setDeltaCollateral(props.contextData.fiat, event.target.value, props.modifyPositionData);
              }}
              placeholder='0'
              inputMode='decimal'
              // Bypass type warning from passing a custom component instead of a string
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              label={
                modifyPositionStore.mode === 'withdraw'
                  ? <InputLabelWithMax
                    label='Collateral to withdraw and swap'
                    onMaxClick={() => modifyPositionStore.setMaxDeltaCollateral(props.contextData.fiat, props.modifyPositionData)}
                  />
                  : <InputLabelWithMax
                    label='Collateral to withdraw and redeem'
                    onMaxClick={() => modifyPositionStore.setMaxDeltaCollateral(props.contextData.fiat, props.modifyPositionData)}
                  />
              }
              labelRight={symbol}
              bordered
              size='sm'
              borderWeight='light'
              width={modifyPositionStore.mode === 'redeem' ? '100%' : '15rem'}
            />
          )}
          {(modifyPositionStore.mode === 'deposit' || modifyPositionStore.mode === 'withdraw') && (
            <Input
              disabled={props.disableActions}
              value={floor2(Number(wadToDec(modifyPositionStore.slippagePct)) * 100)}
              onChange={(event) => {
                modifyPositionStore.setSlippagePct(props.contextData.fiat, event.target.value, props.modifyPositionData);
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
          )}
        </Grid.Container>
        <Input
          disabled={props.disableActions}
          value={floor2(wadToDec(modifyPositionStore.deltaDebt))}
          onChange={(event) => {
            modifyPositionStore.setDeltaDebt(props.contextData.fiat, event.target.value, props.modifyPositionData);
          }}
          placeholder='0'
          inputMode='decimal'
          // Bypass type warning from passing a custom component instead of a string
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          label={
            modifyPositionStore.mode === 'deposit'
              ? 'FIAT to borrow'
              : <InputLabelWithMax
                  label='FIAT to pay back'
                  onMaxClick={() => modifyPositionStore.setMaxDeltaDebt(props.contextData.fiat, props.modifyPositionData)}
                />
          }
          labelRight={'FIAT'}
          bordered
          size='sm'
          borderWeight='light'
        />
      </Modal.Body>
      <Spacer y={0.75} />
      <Card.Divider />
      {(modifyPositionStore.mode === 'deposit' || modifyPositionStore.mode === 'withdraw') && (
        <>
          <Modal.Body>
            <Spacer y={0} />
            <Text b size={'m'}>
              Swap Preview
            </Text>
            <Input
              readOnly
              value={
                (modifyPositionStore.formDataLoading)
                  ? ' '
                  : (modifyPositionStore.mode === 'deposit')
                    ? floor2(wadToDec(modifyPositionStore.deltaCollateral))
                    : floor2(scaleToDec(modifyPositionStore.underlier, underlierScale))
              }
              placeholder='0'
              type='string'
              label={
                modifyPositionStore.mode === 'deposit'
                  ? 'Collateral to deposit (incl. slippage)'
                  : 'Underliers to withdraw (incl. slippage)'
              }
              labelRight={modifyPositionStore.mode === 'deposit' ? symbol : underlierSymbol}
              contentLeft={modifyPositionStore.formDataLoading ? <Loading size='xs' /> : null}
              size='sm'
              status='primary'
            />
          </Modal.Body>
          <Spacer y={0.75} />
          <Card.Divider />
        </>
      )}
      <Modal.Body>
        <Spacer y={0} />
        <Text b size={'m'}>
          Position Preview
        </Text>
        <Input
          readOnly
          value={(modifyPositionStore.formDataLoading)
            ? ' '
            : `${floor2(wadToDec(position.collateral))} → ${floor2(wadToDec(modifyPositionStore.collateral))}`
          }
          placeholder='0'
          type='string'
          label={`Collateral (before: ${floor2(wadToDec(position.collateral))} ${symbol})`}
          labelRight={symbol}
          contentLeft={modifyPositionStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(modifyPositionStore.formDataLoading)
            ? ' '
            : `${floor2(wadToDec(fiat.normalDebtToDebt(position.normalDebt, virtualRate)))} → ${floor2(wadToDec(modifyPositionStore.debt))}`
          }
          placeholder='0'
          type='string'
          label={`Debt (before: ${floor2(wadToDec(fiat.normalDebtToDebt(position.normalDebt, virtualRate)))} FIAT)`}
          labelRight={'FIAT'}
          contentLeft={modifyPositionStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={(() => {
            if (modifyPositionStore.formDataLoading) return ' ';
            let collRatioBefore = fiat.computeCollateralizationRatio(
              position.collateral, fairPrice, position.normalDebt, virtualRate
            );
            collRatioBefore = (collRatioBefore.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(collRatioBefore.mul(100)))}%`;
            const collRatioAfter = (modifyPositionStore.collRatio.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(modifyPositionStore.collRatio.mul(100)))}%`;
            return `${collRatioBefore} → ${collRatioAfter}`;
          })()}
          placeholder='0'
          type='string'
          label={
            `Collateralization Ratio (before: ${(() => {
              const collRatio = fiat.computeCollateralizationRatio(
                position.collateral, fairPrice, position.normalDebt, virtualRate
              );
              if (collRatio.eq(ethers.constants.MaxUint256)) return '∞'
              return floor2(wadToDec(collRatio.mul(100)));
            })()
          }%)`
          }
          labelRight={'🚦'}
          contentLeft={modifyPositionStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
      </Modal.Body>
      <Modal.Footer justify='space-evenly'>
        {modifyPositionStore.mode === 'deposit' && (
          <>
            <Text size={'0.875rem'}>Approve {underlierSymbol}</Text>
            <Switch
              disabled={props.disableActions || !hasProxy}
              // Next UI Switch `checked` type is wrong, this is necessary
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              checked={() => underlierAllowance?.gt(0) && underlierAllowance?.gte(modifyPositionStore.underlier) ?? false}
              onChange={async () => {
                if(!modifyPositionStore.underlier.isZero() && underlierAllowance.gte(modifyPositionStore.underlier)) {
                  try {
                    setRpcError('');
                    await props.unsetUnderlierAllowance(props.contextData.fiat);
                  } catch (e: any) {
                    setRpcError(e.message);
                  }
                } else {
                  try {
                    setRpcError('');
                    await props.setUnderlierAllowance(props.contextData.fiat, modifyPositionStore.underlier)
                  } catch (e: any) {
                    setRpcError(e.message);
                  }
                }
              }}
              color='primary'
              icon={
                ['setUnderlierAllowance', 'unsetUnderlierAllowance'].includes(currentTxAction || '') && props.disableActions ? (
                  <Loading size='xs' />
                ) : null
              }
            />
            <Spacer y={0.5} />
            <Text size={'0.875rem'}>Enable FIAT</Text>
            <Switch
              disabled={props.disableActions || !hasProxy}
              // Next UI Switch `checked` type is wrong, this is necessary
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              checked={() => !!monetaDelegate}
              onChange={async () => {
                if (!!monetaDelegate) {
                  try {
                    setRpcError('');
                    await props.unsetMonetaDelegate(props.contextData.fiat);
                  } catch (e: any) {
                    setRpcError(e.message);
                  }
                } else {
                  try {
                    setRpcError('');
                    await props.setMonetaDelegate(props.contextData.fiat);
                  } catch (e: any) {
                    setRpcError(e.message);
                  }
                }
              }}
              color='primary'
              icon={
                ['setMonetaDelegate', 'unsetMonetaDelegate'].includes(currentTxAction || '') && props.disableActions ? (
                  <Loading size='xs' />
                ) : null
              }
            />
          </>
        )}
        {(modifyPositionStore.mode === 'withdraw' || modifyPositionStore.mode === 'redeem') && (
          <>
            <Text size={'0.875rem'}>Approve FIAT</Text>
            <Switch
              disabled={props.disableActions || !hasProxy}
              // Next UI Switch `checked` type is wrong, this is necessary
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              checked={() => monetaFIATAllowance?.gt(0) && monetaFIATAllowance?.gte(modifyPositionStore.deltaDebt) ?? false}
              onChange={async () => {
                if (modifyPositionStore.deltaDebt.gt(0) && monetaFIATAllowance.gte(modifyPositionStore.deltaDebt)) {
                  try {
                    setRpcError('');
                    await props.unsetMonetaFIATAllowance(props.contextData.fiat);
                  } catch (e: any) {
                    setRpcError(e.message);
                  }
                } else {
                  try {
                    setRpcError('');
                    await props.setMonetaFIATAllowance(props.contextData.fiat, modifyPositionStore.deltaDebt);
                  } catch (e: any) {
                    setRpcError(e.message);
                  }
                }
              }}
              color='primary'
              icon={
                ['setMonetaFIATAllowance', 'unsetMonetaFIATAllowance'].includes(currentTxAction || '') && props.disableActions ? (
                  <Loading size='xs' />
                ) : null
              }
            />
          </>
        )}
        <Spacer y={3} />
        { renderFormAlerts() }
        <Spacer y={0.5} />
        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (props.disableActions || !hasProxy) return true;
            if (modifyPositionStore.formErrors.length !== 0 || modifyPositionStore.formWarnings.length !== 0) return true;
            if (modifyPositionStore.mode === 'deposit') {
              if (monetaDelegate === false) return true;
              if (modifyPositionStore.underlier.isZero() && modifyPositionStore.deltaDebt.isZero()) return true;
              if (!modifyPositionStore.underlier.isZero() && underlierAllowance.lt(modifyPositionStore.underlier)) return true;
            } else if (modifyPositionStore.mode === 'withdraw') {
              if (modifyPositionStore.deltaCollateral.isZero() && modifyPositionStore.deltaDebt.isZero()) return true;
              if (!modifyPositionStore.deltaDebt.isZero() && monetaFIATAllowance.lt(modifyPositionStore.deltaDebt)) return true;
            } else if (modifyPositionStore.mode === 'redeem') {
              if (modifyPositionStore.deltaCollateral.isZero() && modifyPositionStore.deltaDebt.isZero()) return true;
              if (!modifyPositionStore.deltaDebt.isZero() && monetaFIATAllowance.lt(modifyPositionStore.deltaDebt)) return true;
            }
            return false;
          })()}
          icon={
            [
              'buyCollateralAndModifyDebt',
              'sellCollateralAndModifyDebt',
              'redeemCollateralAndModifyDebt',
            ].includes(currentTxAction || '') && props.disableActions ? (
              <Loading size='xs' />
            ) : null
          }
          onPress={async () => {
            try {
              setRpcError('');
              if (modifyPositionStore.mode === 'deposit') {
                await props.buyCollateralAndModifyDebt(modifyPositionStore.deltaCollateral, modifyPositionStore.deltaDebt, modifyPositionStore.underlier);
              } else if (modifyPositionStore.mode === 'withdraw') {
                await props.sellCollateralAndModifyDebt(modifyPositionStore.deltaCollateral, modifyPositionStore.deltaDebt, modifyPositionStore.underlier);
              } else if (modifyPositionStore.mode === 'redeem') {
                await props.redeemCollateralAndModifyDebt(modifyPositionStore.deltaCollateral, modifyPositionStore.deltaDebt);
              }
              props.onClose();
            } catch (e: any) {
              setRpcError(e.message);
            }
          }}
        >
          {modifyPositionStore.mode === 'deposit' && 'Deposit'}
          {modifyPositionStore.mode === 'withdraw' && 'Withdraw'}
          {modifyPositionStore.mode === 'redeem' && 'Redeem'}
        </Button>
      </Modal.Footer>
    </>
  );
};
