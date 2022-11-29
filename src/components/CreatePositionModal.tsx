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
import { Slider } from 'antd';
import 'antd/dist/antd.css';
import { scaleToDec, wadToDec } from '@fiatdao/sdk';

import { commifyToDecimalPlaces, floor2, formatUnixTimestamp } from '../utils';
import { Alert } from './Alert';
import { useModifyPositionStore } from '../stores/modifyPositionStore';

interface CreatePositionModalProps {
  createPosition: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any;
  setUnderlierAllowanceForProxy: (fiat: any, amount: BigNumber) => any;
  unsetUnderlierAllowanceForProxy: (fiat: any) => any;
  contextData: any;
  disableActions: boolean;
  modifyPositionData: any;
  selectedCollateralTypeId: string | null;
  transactionData: any;
  open: boolean;
  onClose: () => void;
}

export const CreatePositionModal = (props: CreatePositionModalProps) => {
  return (
    <Modal
      preventClose
      blur
      closeButton={!props.disableActions}
      open={props.open}
      onClose={() => props.onClose()}
      width='27rem'
    >
      <CreatePositionModalBody {...props} />
    </Modal>
  );
};

const CreatePositionModalBody = (props: CreatePositionModalProps) => {
  const formStore = useModifyPositionStore();
  const [rpcError, setRpcError] = React.useState('');

  if (
    !props.modifyPositionData.collateralType ||
    !props.modifyPositionData.collateralType.metadata
  ) {
    // TODO: add skeleton components instead of loading
    return null;
  }

  const { proxies } = props.contextData;
  const {
    collateralType: {
      metadata: { symbol: tokenSymbol, protocol, asset },
      properties: { underlierScale, underlierSymbol, maturity },
    },
    underlierAllowance,
    underlierBalance,
    monetaDelegate,
  } = props.modifyPositionData;

  if (Math.floor(Date.now() / 1000) > Number(maturity.toString())) {
    return (
      <>
        <Modal.Header>
          <Text id='modal-title' size={18}>
            <Text b size={18}>Matured Asset</Text>
            <br />
            <Text b size={16}>{`${protocol} - ${asset}`}</Text>
            <br />
            <Text b size={14}>{`${formatUnixTimestamp(maturity)}`}</Text>
          </Text>
        </Modal.Header>
      </>
    );
  }

  const { action: currentTxAction } = props.transactionData;

  const hasProxy = proxies.length > 0;

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

    if (formStore.formWarnings.length !== 0) {
      formStore.formWarnings.map((formWarning, idx) => {
        formAlerts.push(<Alert severity='warning' message={formWarning} key={`warn-${idx}`} />);
      });
    }

    if (formStore.formErrors.length !== 0) {
      formStore.formErrors.forEach((formError, idx) => {
        formAlerts.push(<Alert severity='error' message={formError} key={`err-${idx}`} />);
      });
    }

    if (rpcError !== '' && rpcError !== 'ACTION_REJECTED' ) {
      formAlerts.push(<Alert severity='error' message={rpcError} />);
    }

    return formAlerts;
  }
  
  return (
    <>
      <Modal.Header>
        <Text id='modal-title' size={18}>
          <Text b size={18}>Create Position</Text>
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
          disableBlur
          disableShadow
          containerCss={{ justifyContent: 'center', background: 'transparent' }}
        >
          <Navbar.Content enableCursorHighlight variant='highlight-rounded'>
            <Navbar.Link isDisabled={props.disableActions} isActive>Create</Navbar.Link>
          </Navbar.Content>
        </Navbar>
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
              disabled={props.disableActions}
              value={floor2(scaleToDec(formStore.underlier, underlierScale))}
              onChange={(event) => {
                if (!props.selectedCollateralTypeId) {
                  console.error('No selectedCollateralTypeId!');
                  return;
                }
                formStore.setUnderlier(
                  props.contextData.fiat, event.target.value, props.modifyPositionData, props.selectedCollateralTypeId
                );
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
              disabled={props.disableActions}
              value={floor2(Number(wadToDec(formStore.slippagePct)) * 100)}
              onChange={(event) => {
                if (!props.selectedCollateralTypeId) {
                  console.error('No selectedCollateralTypeId!');
                  return;
                }
                formStore.setSlippagePct(
                  props.contextData.fiat, event.target.value, props.modifyPositionData, props.selectedCollateralTypeId
                );
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
          Targeted collateralization ratio ({floor2(wadToDec(formStore.targetedCollRatio.mul(100)))}%)
        </Text>
        <Card variant='bordered' borderWeight='light' style={{height:'100%'}}>
          <Card.Body
            style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem', overflow: 'hidden' }}
          >
            <Slider
              handleStyle={{ borderColor: '#0072F5' }}
              included={false}
              disabled={props.disableActions}
              value={Number(wadToDec(formStore.targetedCollRatio))}
              onChange={(value) => {
                if (!props.selectedCollateralTypeId) {
                  console.error('No selectedCollateralTypeId!');
                  return;
                }
                formStore.setTargetedCollRatio(
                  props.contextData.fiat, value, props.modifyPositionData, props.selectedCollateralTypeId
                );
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
          value={formStore.formDataLoading ? ' ' : floor2(wadToDec(formStore.deltaCollateral))}
          placeholder='0'
          type='string'
          label={'Collateral to deposit (incl. slippage)'}
          labelRight={tokenSymbol}
          contentLeft={formStore.formDataLoading ? <Loading size='xs' /> : null}
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
          value={formStore.formDataLoading ? ' ' : floor2(wadToDec(formStore.collateral))}
          placeholder='0'
          type='string'
          label={'Collateral'}
          labelRight={tokenSymbol}
          contentLeft={formStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={formStore.formDataLoading ? ' ' : floor2(wadToDec(formStore.debt))}
          placeholder='0'
          type='string'
          label='Debt'
          labelRight={'FIAT'}
          contentLeft={formStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        <Input
          readOnly
          value={
            formStore.formDataLoading
              ? ' '
              : formStore.collRatio.eq(ethers.constants.MaxUint256)
              ? '∞'
              : `${floor2(wadToDec(formStore.collRatio.mul(100)))}%`
          }
          placeholder='0'
          type='string'
          label='Collateralization Ratio'
          labelRight={'🚦'}
          contentLeft={formStore.formDataLoading ? <Loading size='xs' /> : null}
          size='sm'
          status='primary'
        />
        {/* <Spacer y={0} />
          <Text b size={'m'}>Summary</Text>
          <Text size='0.75rem'>{(modifyPositionFormData.deltaCollateral.isZero()) ? null : 
      <Text size='0.75rem'>{(modifyPositionFormData.deltaCollateral.isZero()) ? null : 
          <Text size='0.75rem'>{(modifyPositionFormData.deltaCollateral.isZero()) ? null : 
          <>
            Swap <b>{floor2(scaleToDec(modifyPositionFormData.underlier, modifyPositionData.collateralType.properties.underlierScale))} {modifyPositionData.collateralType.properties.underlierSymbol} </b>
            for <b>~{floor2(wadToDec(modifyPositionFormData.deltaCollateral))} {modifyPositionData.collateralType.metadata.symbol}</b>.
            Deposit <b>~{floor2(wadToDec(modifyPositionFormData.deltaCollateral))} {modifyPositionData.collateralType.metadata.symbol}</b> as deltaCollateral.
            Borrow <b>~{floor2(wadToDec(modifyPositionFormData.deltaDebt))} FIAT</b> against the deltaCollateral.
          </>
          }</Text> */}
      </Modal.Body>
      <Modal.Footer justify='space-evenly'>
        <Text size={'0.875rem'}>Approve {underlierSymbol}</Text>
        <Switch
          disabled={props.disableActions || !hasProxy}
          // Next UI Switch `checked` type is wrong, this is necessary
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          checked={() => underlierAllowance?.gt(0) && underlierAllowance?.gte(formStore.underlier) ?? false}
          onChange={async () => {
            if (!formStore.underlier.isZero() && underlierAllowance?.gte(formStore.underlier)) {
              try {
                setRpcError('');
                await props.unsetUnderlierAllowanceForProxy(props.contextData.fiat);
              } catch (e: any) {
                setRpcError(e.message);
              }
            } else {
              try {
                setRpcError('');
                await props.setUnderlierAllowanceForProxy(props.contextData.fiat, formStore.underlier);
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
        <Spacer y={3} />
        { renderFormAlerts() }
        <Spacer y={0.5} />
        <Button
          css={{ minWidth: '100%' }}
          disabled={
            formStore.formErrors.length !== 0 ||
            formStore.formWarnings.length !== 0 ||
            props.disableActions ||
            !hasProxy ||
            formStore.underlier?.isZero() ||
            formStore.deltaCollateral?.isZero() ||
            underlierAllowance?.lt(formStore.underlier) ||
            monetaDelegate === false
          }
          icon={(props.disableActions && currentTxAction === 'createPosition') ? (<Loading size='xs' />) : null}
          onPress={async () => {
            try {
              setRpcError('');
              await props.createPosition(
                formStore.deltaCollateral, formStore.deltaDebt, formStore.underlier
              );
              props.onClose();
            } catch (e: any) {
              setRpcError(e.message);
            }
          }}
        >
          Deposit
        </Button>
      </Modal.Footer>
    </>
  );
};
