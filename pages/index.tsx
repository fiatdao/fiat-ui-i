import React from 'react';
import type { NextPage } from 'next';
import { useAccount, useNetwork, useProvider } from 'wagmi';
import shallow from 'zustand/shallow'
import { useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import { Container, Spacer } from '@nextui-org/react';
import { BigNumber, ContractReceipt, ethers } from 'ethers';
import { FIAT, WAD, wadToDec } from '@fiatdao/sdk';
import { HeaderBar } from '../src/components/HeaderBar';
import { CollateralTypesTable } from '../src/components/CollateralTypesTable';
import { PositionsTable } from '../src/components/PositionsTable';
import { PositionModal } from '../src/components/PositionModal/PositionModal';
import {
  decodeCollateralTypeId, decodePositionId, encodePositionId, getCollateralTypeData, getPositionData
} from '../src/utils';
import * as userActions from '../src/actions';
import { useBorrowStore } from '../src/stores/borrowStore';

export type TransactionStatus = null | 'error' | 'sent' | 'confirming' | 'confirmed';

const Home: NextPage = () => {
  const provider = useProvider();
  const { address, connector } = useAccount({ onConnect: () => resetState(), onDisconnect: () => resetState() });
  const { chain } = useNetwork();
  const addRecentTransaction = useAddRecentTransaction();

  const initialState = React.useMemo(() => ({
    setupListeners: false,
    contextData: {
      fiat: null as null | FIAT,
      explorerUrl: null as null | string,
      user: null as null | string,
      proxies: [] as Array<string>,
      fiatBalance: '' as string,
    },
    positionsData: [] as Array<any>,
    collateralTypesData: [] as Array<any>,
    selectedPositionId: null as null | string,
    selectedCollateralTypeId: null as null | string,
    modifyPositionData: {
      outdated: false,
      collateralType: null as undefined | null | any,
      position: null as undefined | null | any,
      underlierAllowance: null as null | BigNumber, // [underlierScale]
      underlierBalance: null as null | BigNumber, // [underlierScale]
      monetaFIATAllowance: null as null | BigNumber, // [wad]
      proxyFIATAllowance: null as null | BigNumber, // [wad]
    },
    transactionData: {
      action: null as null | string,
      status: null as TransactionStatus,
    },
  }), []) 

  // Only select necessary actions off of the store to minimize re-renders
  const borrowStore = useBorrowStore(
    React.useCallback(
      (state) => ({
        reset: state.reset,
      }),
      []
    ), shallow
  );

  const [initialPageLoad, setInitialPageLoad] = React.useState<boolean>(true);
  const [setupListeners, setSetupListeners] = React.useState(false);
  const [contextData, setContextData] = React.useState(initialState.contextData);
  const [collateralTypesData, setCollateralTypesData] = React.useState(initialState.collateralTypesData);
  const [positionsData, setPositionsData] = React.useState(initialState.positionsData);
  const [modifyPositionData, setModifyPositionData] = React.useState(initialState.modifyPositionData);
  const [transactionData, setTransactionData] = React.useState(initialState.transactionData);
  const [selectedPositionId, setSelectedPositionId] = React.useState(initialState.selectedPositionId);
  const [selectedCollateralTypeId, setSelectedCollateralTypeId] = React.useState(initialState.selectedCollateralTypeId);

  const disableActions = React.useMemo(() => transactionData.status === 'sent', [transactionData.status])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  function resetState() {
    setSetupListeners(initialState.setupListeners);
    setContextData(initialState.contextData);
    setCollateralTypesData(initialState.collateralTypesData);
    setPositionsData(initialState.positionsData);
    setModifyPositionData(initialState.modifyPositionData);
    setTransactionData(initialState.transactionData);
    setSelectedPositionId(initialState.selectedPositionId);
    setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
  }

  const softReset = () => {
    // Soft reset after a transaction
    setModifyPositionData(initialState.modifyPositionData);
    setTransactionData(initialState.transactionData);
    setSelectedPositionId(initialState.selectedPositionId);
    setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
    // Refetch data after a reset
    handleFiatBalance();
    handleCollateralTypesData();
    handlePositionsData();
  }

  const handleFiatBalance = React.useCallback(async () => {
    if (!contextData.fiat || !contextData.user) return;
    const { fiat } = contextData.fiat.getContracts();
    const fiatBalance = await fiat.balanceOf(contextData.user)
    setContextData((curContextData) => ({
      ...curContextData,
      fiatBalance: `${parseFloat(wadToDec(fiatBalance)).toFixed(2)} FIAT`
    }));
  }, [contextData.fiat, contextData.user]);

  const handleCollateralTypesData = React.useCallback(async () => {
    if (!contextData.fiat) return;
    const collateralTypesData_ = await contextData.fiat.fetchCollateralTypesAndPrices([]);
    const earnableRates = await userActions.getEarnableRate(contextData.fiat, collateralTypesData_);

    setCollateralTypesData(collateralTypesData_
      .filter((collateralType: any) => (collateralType.metadata != undefined))
      .sort((a: any, b: any) => {
        if (Number(a.properties.maturity) > Number(b.properties.maturity)) return -1;
        if (Number(a.properties.maturity) < Number(b.properties.maturity)) return 1;
        return 0;
      })
      .map((collateralType: any) => {
        const earnableRate = earnableRates.find((item: any)  => item.vault === collateralType.properties.vault)
        return {
          ...collateralType,
          earnableRate: earnableRate?.earnableRate
        }
      }));
  }, [contextData.fiat]);

  const handlePositionsData = React.useCallback(async () => {
    if (!contextData || !contextData.fiat) return;
    const userData = await contextData.fiat.fetchUserData(contextData.user);
    const positionsData = userData.flatMap((user) => user.positions);
    setPositionsData(positionsData);
  }, [contextData]);

  // Reset state if network or account changes
  React.useEffect(() => {
    if (!connector || setupListeners) return;
    connector.on('change', () => resetState());
    setSetupListeners(true);
  }, [setupListeners, connector, resetState]);

  // Fetch Collateral Types Data
  React.useEffect(() => {
    if (collateralTypesData.length !== 0 || !contextData.fiat) return;
    handleCollateralTypesData();
  }, [collateralTypesData.length, provider, contextData.fiat, handleCollateralTypesData])

  React.useEffect(() => {
    if (!provider || contextData.fiat || connector) return;
    (async function () {
      const fiat = await FIAT.fromProvider(provider, null);
      setContextData((curContextData) => ({
        ...curContextData,
        fiat,
      }));
    })();
  }, [provider, connector, contextData.fiat])

  // Fetch block explorer data
  React.useEffect(() => {
    if (!chain?.blockExplorers?.etherscan?.url) return;
    setContextData((curContextData) => ({
      ...curContextData,
      explorerUrl: chain?.blockExplorers?.etherscan?.url || '',
    }));
  }, [connector, chain?.blockExplorers?.etherscan?.url]);
  
  React.useEffect(() => {
    handleFiatBalance();
  }, [contextData.fiat, handleFiatBalance])

  // Fetch User data, Vault data, and set Fiat SDK in global state
  React.useEffect(() => {
    if (!connector) return;
    
    (async function () {
      const signer = (await connector.getSigner());
      if (!signer || !signer.provider) return;
      const user = await signer.getAddress();
      const fiat = await FIAT.fromSigner(signer, undefined);
      const userData = await fiat.fetchUserData(user.toLowerCase());
      const proxies = userData.filter((user: any) => (user.isProxy === true)).map((user: any) => user.user);
      const positionsData = userData.flatMap((user) => user.positions);
      setPositionsData(positionsData);
      setContextData((curContextData) => ({
        ...curContextData,
        fiat,
        user,
        proxies,
      }));
    })();
    // Address and chain dependencies are needed to recreate FIAT sdk object on account or chain change,
    // even though their values aren't used explicitly.
  }, [connector, address, chain]);

  // Populate ModifyPosition data
  React.useEffect(() => {
    if (
      modifyPositionData.collateralType !== null
      || (selectedCollateralTypeId == null && selectedPositionId == null)
    ) return;

    const { vault, tokenId } = decodeCollateralTypeId((selectedCollateralTypeId || selectedPositionId as string));
    const collateralType = getCollateralTypeData(collateralTypesData, vault, tokenId)

    let position;
    if (selectedPositionId) {
      const { owner } = decodePositionId(selectedPositionId);
      position = getPositionData(positionsData, vault, tokenId, owner);
    }
    const data = { ...modifyPositionData, collateralType, position };

    setModifyPositionData({...data});

    (async function () {
      // For positions with proxies, fetch underlier balance, allowance, fiat allowance, and moneta delegation enablement
      if (contextData.proxies.length === 0) return;
      const { proxies: [proxy] } = contextData;
      if (
        !contextData.fiat ||
        data.collateralType == null ||
        (data.position &&
          data.position.owner.toLowerCase() !== proxy.toLowerCase())
      ) {
        return;
      }

      const { moneta, fiat } = contextData.fiat.getContracts();
      const underlier = contextData.fiat.getERC20Contract(data.collateralType.properties.underlierToken);

      const signer = (await connector?.getSigner());
      if (!signer || !signer.provider) return;
      const user = await signer.getAddress();
      const [underlierAllowance, underlierBalance, monetaFIATAllowance, proxyFIATAllowance] = await contextData.fiat.multicall([
        { contract: underlier, method: 'allowance', args: [user, proxy] },
        { contract: underlier, method: 'balanceOf', args: [user] },
        { contract: fiat, method: 'allowance', args: [proxy, moneta.address] },
        { contract: fiat, method: 'allowance', args: [user, proxy] }
      ]);

      setModifyPositionData({
        ...modifyPositionData, ...data, underlierAllowance, underlierBalance, monetaFIATAllowance, proxyFIATAllowance
      });
    })();

  }, [connector, contextData, collateralTypesData, positionsData, selectedCollateralTypeId, selectedPositionId, modifyPositionData, borrowStore]);

  const sendTransaction = async (
    fiat: any, useProxy: boolean, action: string, contract: ethers.Contract, method: string, ...args: any[]
  ): Promise<ContractReceipt> => {
    try {
      setTransactionData({ action, status: 'sent' });
      // Dryrun every transaction first to catch and decode errors
      useProxy
        ? await fiat.dryrunViaProxy(contextData.proxies[0], contract, method, ...args)
        : await fiat.dryrun(contract, method, ...args);
      const resp = useProxy
        ? await fiat.sendAndWaitViaProxy(contextData.proxies[0], contract, method, ...args)
        : await fiat.sendAndWait(contract, method, ...args);
      setTransactionData(initialState.transactionData);
      return resp;
    } catch (e: any) {
      setTransactionData({ ...transactionData, status: 'error' });
      if (e && e.code && e.code === 'ACTION_REJECTED') {
        // handle rejected transactions by user
        throw new Error('ACTION_REJECTED');
      } else {
        // Should be caught by caller to set appropriate errors
        throw e;
      }
    }
  }

  const createProxy = async (fiat: any, user: string) => {
    const response = await sendTransaction(
      fiat, false, 'createProxy', fiat.getContracts().proxyRegistry, 'deployFor', user
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Create Proxy account' });
    // Querying chain directly after this to update as soon as possible
    const { proxyRegistry } = fiat.getContracts();
    const proxyAddress = await fiat.call(proxyRegistry, 'getCurrentProxy', user);
    setContextData({ ...contextData, proxies: [proxyAddress] });
  }

  const setUnderlierAllowanceForProxy = async (fiat: any, amount: BigNumber) => {
    const token = fiat.getERC20Contract(modifyPositionData.collateralType.properties.underlierToken);
    // add 1 unit has a buffer in case user refreshes the page and the value becomes outdated
    const allowance = amount.add(modifyPositionData.collateralType.properties.underlierScale);
    const response = await sendTransaction(
      fiat, false, 'setUnderlierAllowanceForProxy', token, 'approve', contextData.proxies[0], allowance
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Set underlier allowance for Proxy' });
    const underlierAllowance = await token.allowance(contextData.user, contextData.proxies[0])
    setModifyPositionData({ ...modifyPositionData, underlierAllowance });
  }

  const unsetUnderlierAllowanceForProxy = async (fiat: any) => {
    const token = fiat.getERC20Contract(modifyPositionData.collateralType.properties.underlierToken);
    const response =  await sendTransaction(
      fiat, false, 'unsetUnderlierAllowanceForProxy', token, 'approve', contextData.proxies[0], 0
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Reset underlier allowance for Proxy' });
  }

  const setFIATAllowanceForMoneta = async (fiat: any) => {
    const { moneta, vaultEPTActions, fiat: token } = fiat.getContracts();
    const response = await sendTransaction(
      // approveFIAT is implemented for all Actions contract
      fiat, true, 'setFIATAllowanceForMoneta', vaultEPTActions, 'approveFIAT', moneta.address, ethers.constants.MaxUint256
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Set FIAT allowance Moneta' });
    const monetaFIATAllowance = await token.allowance(contextData.proxies[0], moneta.address)
    setModifyPositionData({ ...modifyPositionData, monetaFIATAllowance });
  }

  const setFIATAllowanceForProxy = async (fiat: any, amount: BigNumber) => {
    const { fiat: token } = fiat.getContracts();
    // add 1 unit has a buffer in case user refreshes the page and the value becomes outdated
    const allowance = amount.add(WAD);
    const response = await sendTransaction(
      fiat, false, 'setFIATAllowanceForProxy', token, 'approve', contextData.proxies[0], allowance
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Set  FIAT allowance for Proxy' });
    const proxyFIATAllowance = await token.allowance(contextData.user, contextData.proxies[0]);
    setModifyPositionData({ ...modifyPositionData, proxyFIATAllowance });
  }

  const unsetFIATAllowanceForProxy = async (fiat: any) => {
    const { fiat: token } = fiat.getContracts();
    const response = await sendTransaction(
      fiat, false, 'unsetFIATAllowanceForProxy', token, 'approve', contextData.proxies[0], 0
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Reset FIAT allowance for Proxy' });
  }

  const createPosition = async (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => {
    const args = userActions.buildBuyCollateralAndModifyDebtArgs(
      contextData, modifyPositionData.collateralType, deltaCollateral, deltaDebt, underlier
    );
    const response = await sendTransaction(
      contextData.fiat, true, 'createPosition', args.contract, args.methodName, ...args.methodArgs
    );
    addRecentTransaction({ hash: response.transactionHash, description: 'Create position' });
    softReset();
  }

  const buyCollateralAndModifyDebt = async (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => {
    const { collateralType, position } = modifyPositionData;
    if (deltaCollateral.isZero()) {
       // increase (mint)
      const args = userActions.buildModifyCollateralAndDebtArgs(contextData, collateralType, deltaDebt, position);
      const response = await sendTransaction(
        contextData.fiat, true, 'modifyCollateralAndDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({ hash: response.transactionHash, description: 'Borrow FIAT' });
      softReset();
    } else {
      const args = userActions.buildBuyCollateralAndModifyDebtArgs(
        contextData, collateralType, deltaCollateral, deltaDebt, underlier
      );
      const response = await sendTransaction(
        contextData.fiat, true, 'buyCollateralAndModifyDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({
        hash: response.transactionHash, description: 'Buy and deposit collateral and borrow FIAT'
      });
      softReset();
      return response;
    }
  }

  const sellCollateralAndModifyDebt = async (deltaCollateral: BigNumber, deltaDebt: BigNumber, underlier: BigNumber) => {
    const { collateralType, position } = modifyPositionData;
    if (deltaCollateral.isZero()) {
      // decrease (pay back)
      const args = userActions.buildModifyCollateralAndDebtArgs(
        contextData, collateralType, deltaDebt.mul(-1), position
      );
      const response = await sendTransaction(
        contextData.fiat, true, 'modifyCollateralAndDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({ hash: response.transactionHash, description: 'Repay borrowed FIAT' });
      softReset();
    }
    else {
      const args = userActions.buildSellCollateralAndModifyDebtArgs(
        contextData, collateralType, deltaCollateral, deltaDebt, underlier, position,
      );
      const response = await sendTransaction(
        contextData.fiat, true, 'sellCollateralAndModifyDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({
        hash: response.transactionHash, description: 'Withdraw and sell collateral and repay borrowed FIAT'
      });
      softReset();
    }
  }

  const redeemCollateralAndModifyDebt = async (deltaCollateral: BigNumber, deltaDebt: BigNumber) => {
    const { collateralType, position } = modifyPositionData;
    if (deltaCollateral.isZero()) {
       // decrease (pay back)
      const args = userActions.buildModifyCollateralAndDebtArgs(
        contextData, collateralType, deltaDebt.mul(-1), position
      );
      const response = await sendTransaction(
        contextData.fiat, true, 'modifyCollateralAndDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({ hash: response.transactionHash, description: 'Repay borrowed FIAT' });
      softReset();
    }
    else {
      const args = userActions.buildRedeemCollateralAndModifyDebtArgs(
        contextData, collateralType, deltaCollateral, deltaDebt, position
      );
      const response = await sendTransaction(
        contextData.fiat, true, 'redeemCollateralAndModifyDebt', args.contract, args.methodName, ...args.methodArgs
      );
      addRecentTransaction({
        hash: response.transactionHash, description: 'Withdraw and redeem collateral and repay borrowed FIAT'
      });
      softReset();
    }
  }

  // Cycle the first page render to allow styles to load
  React.useEffect(() => {
    setInitialPageLoad(false);
  }, []);

  if (initialPageLoad) return null;

  return (
    <div>
      <HeaderBar 
        contextData={contextData} 
        transactionData={transactionData}
        disableActions={disableActions}
        createProxy={createProxy}
      />
      <Container lg>
        {
          positionsData === null || positionsData.length === 0
            ? null
            : (
              <>
                <PositionsTable
                  contextData={contextData}
                  collateralTypesData={collateralTypesData}
                  positionsData={positionsData}
                  onSelectPosition={(positionId) => {
                    setSelectedPositionId(positionId);
                    setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
                  }}
                />
                <Spacer y={2} />
              </>
            )
        }
      </Container>
      <Container lg>
        <CollateralTypesTable
          collateralTypesData={collateralTypesData}
          positionsData={positionsData}
          onSelectCollateralType={(collateralTypeId) => {
            // If user has an existing position for the collateral type then open PositionModal instead
            const { vault, tokenId } = decodeCollateralTypeId(collateralTypeId);
            const positionData = getPositionData(positionsData, vault, tokenId, contextData.proxies[0]);
            if (positionData !== undefined) {
              const positionId = encodePositionId(vault, tokenId, positionData.owner);
              setSelectedPositionId(positionId);
              setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
            } else {
              setSelectedPositionId(initialState.selectedPositionId);
              setSelectedCollateralTypeId(collateralTypeId);
            }
          }}
        />
      </Container>

      <PositionModal
        buyCollateralAndModifyDebt={buyCollateralAndModifyDebt}
        contextData={contextData}
        createPosition={createPosition}
        disableActions={disableActions}
        modifyPositionData={modifyPositionData}
        redeemCollateralAndModifyDebt={redeemCollateralAndModifyDebt}
        sellCollateralAndModifyDebt={sellCollateralAndModifyDebt}
        selectedPositionId={selectedPositionId}
        selectedCollateralTypeId={selectedCollateralTypeId}
        setFIATAllowanceForProxy={setFIATAllowanceForProxy}
        unsetFIATAllowanceForProxy={unsetFIATAllowanceForProxy}
        setFIATAllowanceForMoneta={setFIATAllowanceForMoneta}
        setUnderlierAllowanceForProxy={setUnderlierAllowanceForProxy}
        unsetUnderlierAllowanceForProxy={unsetUnderlierAllowanceForProxy}
        transactionData={transactionData}
        setTransactionStatus={(status) =>
          setTransactionData({ ...transactionData, status })
        }
        open={!!modifyPositionData && (!!selectedCollateralTypeId || !!selectedPositionId)}
        onClose={() => {
          setSelectedPositionId(initialState.selectedPositionId);
          setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
          setModifyPositionData(initialState.modifyPositionData);
          borrowStore.reset();
        }}
      />
      <Spacer />
    </div>
  );
};

export default Home;
