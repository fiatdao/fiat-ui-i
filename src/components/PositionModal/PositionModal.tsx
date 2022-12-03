import { Modal, Navbar, Text } from '@nextui-org/react';
import 'antd/dist/antd.css';
import { BigNumber } from 'ethers';
import React, { useState } from 'react';
import { TransactionStatus } from '../../../pages';
import { Mode, useBorrowStore } from '../../stores/borrowStore';
import { formatUnixTimestamp } from '../../utils';
import { CreateForm, DecreaseForm, IncreaseForm, RedeemForm } from './BorrowForms';
import { LeverCreateForm, LeverDecreaseForm, LeverIncreaseForm, LeverRedeemForm } from './LeverForms';

interface PositionModalProps {
  buyCollateralAndModifyDebt: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any;
  createPosition: (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => any;
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
  selectedCollateralTypeId: string | null;
  selectedPositionId: string | null;
  transactionData: any;
  open: boolean;
  onClose: () => void;
}

export const PositionModal = (props: PositionModalProps) => {
  return (
    <Modal
      preventClose
      closeButton={!props.disableActions}
      blur
      open={props.open}
      onClose={() => props.onClose()}
      width='27rem'
    >
      <PositionModalBody {...props} />
    </Modal>
  );
};

const PositionModalBody = (props: PositionModalProps) => {
  const borrowStore = useBorrowStore();
  const [ leverModeActive, setLeverModeActive ] = useState(false);

  const matured = React.useMemo(() => {
    const maturity = props.modifyPositionData.collateralType?.properties.maturity.toString();
    return (maturity !== undefined && !(new Date() < new Date(Number(maturity) * 1000)));
  }, [props.modifyPositionData.collateralType?.properties.maturity])

  // Set initial mode of modal depending on props
  React.useEffect(() => {
    if (!!props.selectedCollateralTypeId && borrowStore.mode !== Mode.CREATE) {
      borrowStore.setMode(Mode.CREATE);
    } else if (props.modifyPositionData.position && matured && borrowStore.mode !== Mode.REDEEM) {
      borrowStore.setMode(Mode.REDEEM);
    }  
    // these deps _are_ exhaustive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.modifyPositionData.position, borrowStore.mode, borrowStore.setMode, props.selectedCollateralTypeId, matured])

  if (!props.contextData.user || !props.modifyPositionData.collateralType || !props.modifyPositionData.collateralType.metadata ) {
    // TODO: add skeleton components instead of null
    return null;
  }

  const renderNavbarLinks = () => {
    if (!props.modifyPositionData.position) {
      return <Navbar.Link isDisabled={props.disableActions} isActive>Create</Navbar.Link>
    }

    if (!matured) {
      return (
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
      );
    } else {
      return (
        <Navbar.Link isDisabled={props.disableActions || !matured} isActive={borrowStore.mode === Mode.REDEEM}>
          Redeem
        </Navbar.Link>
      );
    }
  }

  const renderForm = () => {
    if (leverModeActive) {
    return !!props.selectedCollateralTypeId && borrowStore.mode === Mode.CREATE
        ? <LeverCreateForm
            contextData={props.contextData}
            disableActions={props.disableActions}
            modifyPositionData={props.modifyPositionData}
            transactionData={props.transactionData}
            onClose={props.onClose}
            createPosition={props.createPosition}
            setUnderlierAllowanceForProxy={props.setUnderlierAllowanceForProxy}
            unsetUnderlierAllowanceForProxy={props.unsetUnderlierAllowanceForProxy}
        />
        : !!props.selectedPositionId && borrowStore.mode === Mode.INCREASE
        ? <LeverIncreaseForm
            contextData={props.contextData}
            disableActions={props.disableActions}
            modifyPositionData={props.modifyPositionData}
            transactionData={props.transactionData}
            onClose={props.onClose}
            buyCollateralAndModifyDebt={props.buyCollateralAndModifyDebt}
            setUnderlierAllowanceForProxy={props.setUnderlierAllowanceForProxy}
            unsetUnderlierAllowanceForProxy={props.unsetUnderlierAllowanceForProxy}
            
          />
        : !!props.selectedPositionId && borrowStore.mode === Mode.DECREASE
        ? <LeverDecreaseForm
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
        : !!props.selectedPositionId && borrowStore.mode === Mode.REDEEM
        ? <LeverRedeemForm
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
    } else {
    return !!props.selectedCollateralTypeId && borrowStore.mode === Mode.CREATE
        ? <CreateForm
            contextData={props.contextData}
            disableActions={props.disableActions}
            modifyPositionData={props.modifyPositionData}
            transactionData={props.transactionData}
            onClose={props.onClose}
            createPosition={props.createPosition}
            setUnderlierAllowanceForProxy={props.setUnderlierAllowanceForProxy}
            unsetUnderlierAllowanceForProxy={props.unsetUnderlierAllowanceForProxy}
        />
        : !!props.selectedPositionId && borrowStore.mode === Mode.INCREASE
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
        : !!props.selectedPositionId && borrowStore.mode === Mode.DECREASE
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
        : !!props.selectedPositionId && borrowStore.mode === Mode.REDEEM
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
  }

  if (!props.modifyPositionData.position && matured) {
    return (
      <Modal.Header>
        <Text id='modal-title' size={18}>
          <Text b size={18}>Matured Asset</Text>
          <br />
          <Text b size={16}>{`${props.modifyPositionData.collateralType.metadata.protocol} - ${props.modifyPositionData.collateralType.metadata.asset}`}</Text>
          <br />
          <Text b size={14}>{`${formatUnixTimestamp(props.modifyPositionData.collateralType.properties.maturity)}`}</Text>
        </Text>
      </Modal.Header>
    );
  }

  return (
    <>
      <Modal.Header>
        <Text id='modal-title' size={18}>
          <Text b size={18}>
            {borrowStore.mode === Mode.CREATE ? 'Create' : 'Modify'} Position
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
            <Navbar.Link
              isDisabled={props.disableActions}
              isActive={!leverModeActive}
              onClick={() => {
                setLeverModeActive(false)
              }}
            >
              Borrow
            </Navbar.Link>
            <Navbar.Link
              isDisabled={props.disableActions}
              isActive={leverModeActive}
              onClick={() => {
                setLeverModeActive(true)
              }}
            >
              Lever
            </Navbar.Link>
          </Navbar.Content>
        </Navbar>
      </Modal.Body>
      <Modal.Body>
        <Navbar
          variant='static'
          isCompact
          disableShadow
          disableBlur
          containerCss={{ justifyContent: 'center', background: 'transparent' }}
        >
          <Navbar.Content enableCursorHighlight variant='highlight-rounded'>
            { renderNavbarLinks() }
          </Navbar.Content>
        </Navbar>
      </Modal.Body>

      { renderForm() }
    </>
  );
};
