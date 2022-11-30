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
  const [rpcError, setRpcError] = React.useState('');

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

  const { proxies, fiat } = props.contextData;
  const {
    collateralType: {
      metadata: { symbol: symbol, protocol, asset },
      properties: { underlierScale, underlierSymbol, maturity },
      state: { codex: { virtualRate }, collybus: { fairPrice }}
    },
    underlierAllowance,
    monetaDelegate,
    monetaFIATAllowance,
    proxyFIATAllowance,
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
                  isActive={modifyPositionStore.mode === Mode.INCREASE}
                  onClick={() => {
                    if (props.disableActions) return;
                    modifyPositionStore.resetCollateralAndDebtInputs(props.contextData.fiat, props.modifyPositionData);
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
                    modifyPositionStore.resetCollateralAndDebtInputs(props.contextData.fiat, props.modifyPositionData);
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
                  modifyPositionStore.resetCollateralAndDebtInputs(props.contextData.fiat, props.modifyPositionData);
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
        ? <IncreaseInputs
            contextData={props.contextData}
            disableActions={props.disableActions}
            modifyPositionData={props.modifyPositionData}
            symbol={symbol}
            underlierSymbol={underlierSymbol}
          />
        : modifyPositionStore.mode === Mode.DECREASE
        ? <DecreaseInputs
            contextData={props.contextData}
            disableActions={props.disableActions}
            modifyPositionData={props.modifyPositionData}
            symbol={symbol}
          />
        : modifyPositionStore.mode === Mode.REDEEM
        ? <RedeemInputs
            contextData={props.contextData}
            disableActions={props.disableActions}
            modifyPositionData={props.modifyPositionData}
            symbol={symbol}
          />
        : null
      }

      <Spacer y={0.75} />
      <Card.Divider />

      {(modifyPositionStore.mode === Mode.INCREASE || modifyPositionStore.mode === Mode.DECREASE) && (
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
                  : (modifyPositionStore.mode === Mode.INCREASE)
                    ? floor2(wadToDec(modifyPositionStore.deltaCollateral))
                    : floor2(scaleToDec(modifyPositionStore.underlier, underlierScale))
              }
              placeholder='0'
              type='string'
              label={
                modifyPositionStore.mode === Mode.INCREASE
                  ? 'Collateral to deposit (incl. slippage)'
                  : 'Underliers to withdraw (incl. slippage)'
              }
              labelRight={modifyPositionStore.mode === Mode.INCREASE ? symbol : underlierSymbol}
              contentLeft={modifyPositionStore.formDataLoading ? <Loading size='xs' /> : null}
              size='sm'
              status='primary'
            />
          </Modal.Body>
          <Spacer y={0.75} />
          <Card.Divider />
        </>
      )}

      <Spacer y={0.75} />
      <Modal.Body>
        <PositionPreview
          fiat={props.contextData.fiat}
          formDataLoading={modifyPositionStore.formDataLoading}
          positionCollateral={position.collateral}
          positionNormalDebt={position.normalDebt}
          estimatedCollateral={modifyPositionStore.collateral}
          estimatedCollateralRatio={modifyPositionStore.collRatio}
          estimatedDebt={modifyPositionStore.debt}
          virtualRate={virtualRate}
          fairPrice={fairPrice}
          symbol={symbol}
        />
      </Modal.Body>

      <Modal.Footer justify='space-evenly'>
        {modifyPositionStore.mode === Mode.INCREASE && (
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
                    await props.unsetUnderlierAllowanceForProxy(props.contextData.fiat);
                  } catch (e: any) {
                    setRpcError(e.message);
                  }
                } else {
                  try {
                    setRpcError('');
                    await props.setUnderlierAllowanceForProxy(props.contextData.fiat, modifyPositionStore.underlier)
                  } catch (e: any) {
                    setRpcError(e.message);
                  }
                }
              }}
              color='primary'
              icon={
                ['setUnderlierAllowanceForProxy', 'unsetUnderlierAllowanceForProxy'].includes(currentTxAction || '') && props.disableActions ? (
                  <Loading size='xs' />
                ) : null
              }
            />
          </>
        )}
        {(modifyPositionStore.mode === Mode.DECREASE || modifyPositionStore.mode === Mode.REDEEM) && (
          <>
            <Text size={'0.875rem'}>Approve FIAT for Proxy</Text>
            <Switch
              disabled={props.disableActions || !hasProxy}
              // Next UI Switch `checked` type is wrong, this is necessary
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              checked={() => proxyFIATAllowance?.gt(0) && proxyFIATAllowance?.gte(modifyPositionStore.deltaDebt) ?? false}
              onChange={async () => {
                if (modifyPositionStore.deltaDebt.gt(0) && proxyFIATAllowance.gte(modifyPositionStore.deltaDebt)) {
                  try {
                    setRpcError('');
                    await props.unsetFIATAllowanceForProxy(props.contextData.fiat);
                  } catch (e: any) {
                    setRpcError(e.message);
                  }
                } else {
                  try {
                    setRpcError('');
                    await props.setFIATAllowanceForProxy(props.contextData.fiat, modifyPositionStore.deltaDebt);
                  } catch (e: any) {
                    setRpcError(e.message);
                  }
                }
              }}
              color='primary'
              icon={
                ['setFIATAllowanceForProxy', 'unsetFIATAllowanceForProxy'].includes(currentTxAction || '') && props.disableActions ? (
                  <Loading size='xs' />
                ) : null
              }
            />
            <Spacer y={3} />
            {monetaFIATAllowance?.lt(modifyPositionStore.deltaDebt) && (
              <>
                <Spacer y={3} />
                <Button
                  css={{ minWidth: '100%' }}
                  disabled={(() => {
                    if (props.disableActions || !hasProxy) return true;
                    if (monetaFIATAllowance?.gt(0) && monetaFIATAllowance?.gte(modifyPositionStore.deltaDebt)) return true;
                    return false;
                  })()}
                  icon={(['setFIATAllowanceForMoneta'].includes(currentTxAction || '') && props.disableActions)
                    ? (<Loading size='xs' />)
                    : null
                  }
                  onPress={async () => {
                    try {
                      setRpcError('');
                      await props.setFIATAllowanceForMoneta(props.contextData.fiat);
                    } catch (e: any) {
                      setRpcError(e.message);
                    }
                  }}
                >
                  Approve FIAT for Moneta (One Time Action)
                </Button>
              </>
            )}
          </>
        )}
        { renderFormAlerts() }
        <Button
          css={{ minWidth: '100%' }}
          disabled={(() => {
            if (props.disableActions || !hasProxy) return true;
            if (modifyPositionStore.formErrors.length !== 0 || modifyPositionStore.formWarnings.length !== 0) return true;
            if (modifyPositionStore.mode === Mode.INCREASE) {
              if (monetaDelegate === false) return true;
              if (modifyPositionStore.underlier.isZero() && modifyPositionStore.deltaDebt.isZero()) return true;
              if (!modifyPositionStore.underlier.isZero() && underlierAllowance.lt(modifyPositionStore.underlier)) return true;
            } else if (modifyPositionStore.mode === Mode.DECREASE) {
              if (modifyPositionStore.deltaCollateral.isZero() && modifyPositionStore.deltaDebt.isZero()) return true;
              if (!modifyPositionStore.deltaDebt.isZero() && monetaFIATAllowance.lt(modifyPositionStore.deltaDebt)) return true;
            } else if (modifyPositionStore.mode === Mode.REDEEM) {
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
              if (modifyPositionStore.mode === Mode.INCREASE) {
                await props.buyCollateralAndModifyDebt(modifyPositionStore.deltaCollateral, modifyPositionStore.deltaDebt, modifyPositionStore.underlier);
              } else if (modifyPositionStore.mode === Mode.DECREASE) {
                await props.sellCollateralAndModifyDebt(modifyPositionStore.deltaCollateral, modifyPositionStore.deltaDebt, modifyPositionStore.underlier);
              } else if (modifyPositionStore.mode === Mode.REDEEM) {
                await props.redeemCollateralAndModifyDebt(modifyPositionStore.deltaCollateral, modifyPositionStore.deltaDebt);
              }
              props.onClose();
            } catch (e: any) {
              setRpcError(e.message);
            }
          }}
        >
          {modifyPositionStore.mode === Mode.INCREASE && 'Increase'}
          {modifyPositionStore.mode === Mode.DECREASE && 'Decrease'}
          {modifyPositionStore.mode === Mode.REDEEM && 'Redeem'}
        </Button>
      </Modal.Footer>
    </>
  );
};

const IncreaseInputs = ({
  contextData,
  disableActions,
  modifyPositionData,
  underlierSymbol,
}: {
  contextData: any,
  disableActions: boolean,
  modifyPositionData: any,
  symbol: string,
  underlierSymbol: string,
}) => {
  // TODO: select increase state & actions off store
  const modifyPositionStore = useModifyPositionStore();
  return (
    <Modal.Body>
      <Text b size={'m'}>
        Inputs
      </Text>
      {modifyPositionData.underlierBalance && (
        <Text size={'$sm'}>
          Wallet: {commifyToDecimalPlaces(modifyPositionData.underlierBalance, modifyPositionData.collateralType.properties.underlierScale, 2)} {underlierSymbol}
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
          value={floor2(scaleToDec(modifyPositionStore.underlier, modifyPositionData.collateralType.properties.underlierScale))}
          onChange={(event) => {
            modifyPositionStore.setUnderlier(contextData.fiat, event.target.value, modifyPositionData);
          }}
          placeholder='0'
          inputMode='decimal'
          labelRight={underlierSymbol}
          bordered
          size='sm'
          borderWeight='light'
          width='15rem'
        />
        <Input
          disabled={disableActions}
          value={floor2(Number(wadToDec(modifyPositionStore.slippagePct)) * 100)}
          onChange={(event) => {
            modifyPositionStore.setSlippagePct(contextData.fiat, event.target.value, modifyPositionData);
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
        value={floor5(wadToDec(modifyPositionStore.deltaDebt))}
        onChange={(event) => {
          modifyPositionStore.setDeltaDebt(contextData.fiat, event.target.value,modifyPositionData);
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
  )
}

const DecreaseInputs = ({
  contextData,
  disableActions,
  modifyPositionData,
  symbol,
}: {
  contextData: any,
  disableActions: boolean,
  modifyPositionData: any,
  symbol: string,
}) => {
  // TODO: select decrease state & actions off store
  const modifyPositionStore = useModifyPositionStore();

  return (
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
          value={floor2(wadToDec(modifyPositionStore.deltaCollateral))}
          onChange={(event) => {
            modifyPositionStore.setDeltaCollateral(contextData.fiat, event.target.value, modifyPositionData);
          }}
          placeholder='0'
          inputMode='decimal'
          // Bypass type warning from passing a custom component instead of a string
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          label={
            <InputLabelWithMax
              label='Collateral to withdraw and swap'
              onMaxClick={() => modifyPositionStore.setMaxDeltaCollateral(contextData.fiat, modifyPositionData)}
            />
          }
          labelRight={symbol}
          bordered
          size='sm'
          borderWeight='light'
          width={'15rem'}
        />
        <Input
          disabled={disableActions}
          value={floor2(Number(wadToDec(modifyPositionStore.slippagePct)) * 100)}
          onChange={(event) => {
            modifyPositionStore.setSlippagePct(contextData.fiat, event.target.value, modifyPositionData);
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
        value={floor5(wadToDec(modifyPositionStore.deltaDebt))}
        onChange={(event) => {
          modifyPositionStore.setDeltaDebt(contextData.fiat, event.target.value,modifyPositionData);
        }}
        placeholder='0'
        inputMode='decimal'
        // Bypass type warning from passing a custom component instead of a string
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        label={
          <InputLabelWithMax
            label='FIAT to pay back'
            onMaxClick={() => modifyPositionStore.setMaxDeltaDebt(contextData.fiat, modifyPositionData)}
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
  )
}

const RedeemInputs = ({
  contextData,
  disableActions,
  modifyPositionData,
  symbol,
}: {
  contextData: any,
  disableActions: boolean,
  modifyPositionData: any,
  symbol: string,
}) => {
  // TODO: select redeem state & actions off store
  const modifyPositionStore = useModifyPositionStore();

  return (
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
          value={floor2(wadToDec(modifyPositionStore.deltaCollateral))}
          onChange={(event) => {
            modifyPositionStore.setDeltaCollateral(contextData.fiat, event.target.value, modifyPositionData);
          }}
          placeholder='0'
          inputMode='decimal'
          // Bypass type warning from passing a custom component instead of a string
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          label={<InputLabelWithMax label='Collateral to withdraw and redeem' onMaxClick={() => modifyPositionStore.setMaxDeltaCollateral(contextData.fiat, modifyPositionData)} /> }
          labelRight={symbol}
          bordered
          size='sm'
          borderWeight='light'
          width={'100%'}
        />
      </Grid.Container>
      <Input
        disabled={disableActions}
        value={floor5(wadToDec(modifyPositionStore.deltaDebt))}
        onChange={(event) => {
          modifyPositionStore.setDeltaDebt(contextData.fiat, event.target.value,modifyPositionData);
        }}
        placeholder='0'
        inputMode='decimal'
        // Bypass type warning from passing a custom component instead of a string
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        label={<InputLabelWithMax label='FIAT to pay back' onMaxClick={() => modifyPositionStore.setMaxDeltaDebt(contextData.fiat, modifyPositionData)} />}
        labelRight={'FIAT'}
        bordered
        size='sm'
        borderWeight='light'
      />
      <Text size={'$sm'}>
        Note: When closing your position make sure you have enough FIAT to cover the accrued borrow fees.
      </Text>
    </Modal.Body>
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

