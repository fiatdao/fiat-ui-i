import React from 'react';
import type { NextPage } from 'next';
import { useAccount, useNetwork, useProvider } from 'wagmi';
import { ConnectButton, useAddRecentTransaction } from '@rainbow-me/rainbowkit';
import { Badge, Button, Container, Spacer } from '@nextui-org/react';
import { ethers } from 'ethers';
import { decToWad, FIAT, WAD, wadToDec, ZERO } from '@fiatdao/sdk';

import { connectButtonCSS, ProxyButton } from '../src/components/ProxyButton';
import { CollateralTypesTable } from '../src/components/CollateralTypesTable';
import { PositionsTable } from '../src/components/PositionsTable';
import { CreatePositionModal } from '../src/components/CreatePositionModal';
import { ModifyPositionModal } from '../src/components/ModifyPositionModal';
import { InfoModal } from '../src/components/InfoModal';
import {
  decodeCollateralTypeId, decodePositionId, encodePositionId, getCollateralTypeData, getPositionData
} from '../src/utils';
import * as userActions from '../src/actions';
import { useModifyPositionFormDataStore } from '../src/stores/formStore';
import { InfoIcon } from '../src/components/Icons/info'; 

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
      proxies: [] as Array<string>
    },
    positionsData: [] as Array<any>,
    collateralTypesData: [] as Array<any>,
    selectedPositionId: null as null | string,
    selectedCollateralTypeId: null as null | string,
    modifyPositionData: {
      outdated: false,
      collateralType: null as undefined | null | any,
      position: null as undefined | null | any,
      underlierAllowance: null as null | ethers.BigNumber, // [underlierScale]
      underlierBalance: null as null | ethers.BigNumber, // [underlierScale]
      monetaDelegate: null as null | boolean, // [boolean]
      fiatAllowance: null as null | ethers.BigNumber // [wad]
    },
    modifyPositionFormData: {
      outdated: true,
      mode: 'deposit', // [deposit, withdraw, redeem]
      slippagePct: decToWad('0.001') as ethers.BigNumber, // [wad]
      underlier: ZERO as ethers.BigNumber, // [underlierScale]
      deltaCollateral: ZERO as ethers.BigNumber, // [wad]
      deltaDebt: ZERO as ethers.BigNumber, // [wad]
      targetedHealthFactor: decToWad('1.2') as ethers.BigNumber, // [wad]
      collateral: ZERO as ethers.BigNumber, // [wad]
      debt: ZERO as ethers.BigNumber, // [wad]
      healthFactor: ZERO as ethers.BigNumber, // [wad] estimated new health factor
      error: null as null | string
    },
    transactionData: {
      action: null as null | string,
      status: null as TransactionStatus,
    },
    fiatBalance: '',
  }), []) 

  const formDataStore = useModifyPositionFormDataStore();

  const [setupListeners, setSetupListeners] = React.useState(false);
  const [contextData, setContextData] = React.useState(initialState.contextData);
  const [collateralTypesData, setCollateralTypesData] = React.useState(initialState.collateralTypesData);
  const [positionsData, setPositionsData] = React.useState(initialState.positionsData);
  const [modifyPositionData, setModifyPositionData] = React.useState(initialState.modifyPositionData);
  const [transactionData, setTransactionData] = React.useState(initialState.transactionData);
  const [selectedPositionId, setSelectedPositionId] = React.useState(initialState.selectedPositionId);
  const [selectedCollateralTypeId, setSelectedCollateralTypeId] = React.useState(initialState.selectedCollateralTypeId);
  const [fiatBalance, setFiatBalance] = React.useState<string>(initialState.fiatBalance);
  const [showInfoModal, setShowInfoModal] = React.useState<boolean>(false);

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
    setFiatBalance(initialState.fiatBalance);
  }

  const handleFinishedTransaction = () => {
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
    setFiatBalance(`${parseFloat(wadToDec(fiatBalance)).toFixed(2)} FIAT`)
  }, [contextData]);

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
  }, [chain?.blockExplorers?.etherscan?.url]);
  
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
    formDataStore.setFormDataLoading(true);
    formDataStore.calculateNewPositionData(contextData.fiat, data, selectedCollateralTypeId);
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

      const { codex, moneta, fiat } = contextData.fiat.getContracts();
      const underlier = contextData.fiat.getERC20Contract(data.collateralType.properties.underlierToken);

      const signer = (await connector?.getSigner());
      if (!signer || !signer.provider) return;
      const user = await signer.getAddress();
      const [underlierAllowance, underlierBalance, monetaDelegate, fiatAllowance] = await contextData.fiat.multicall([
        { contract: underlier, method: 'allowance', args: [user, proxy] },
        { contract: underlier, method: 'balanceOf', args: [user] },
        { contract: codex, method: 'delegates', args: [proxy, moneta.address] },
        { contract: fiat, method: 'allowance', args: [user, proxy] }
      ]);

      setModifyPositionData({
        ...modifyPositionData, ...data, underlierAllowance, underlierBalance, monetaDelegate, fiatAllowance
      });
    })();

    // Eslint thinks formDataStore is a dependency, but that will never change. The only true dependency is its the calculateNewPositionData method
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connector, contextData, collateralTypesData, positionsData, selectedCollateralTypeId, selectedPositionId, modifyPositionData, formDataStore.calculateNewPositionData]);

  const dryRun = async (fiat: any, action: string, contract: ethers.Contract, method: string, ...args: any[]) => {
    try {
      setTransactionData({ action, status: 'sent' });

      // OPTIONAL:
      // uncomment setTimeout(resolve(...)) simulate loading state of a real txn
      // uncomment setTimeout(reject(...)) to simulate a txn error
      await new Promise((resolve: any, reject: any) => {
        setTimeout(resolve, 2000);
        // setTimeout(reject({message: 'Mock dryrun error, Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut convallis luctus lectus vel tempor. Vestibulum porta odio et dui pretium, nec hendrerit ante efficitur. Duis cursus eleifend fringilla.'}), 2000);
      });

      const resp = await fiat.dryrun(contract, method, ...args);
      setTransactionData(initialState.transactionData);
      return resp;
    } catch (e) {
      console.error('Dryrun error: ', e);
      setTransactionData({ ...transactionData, status: 'error' });
      // Should be caught by caller to set appropriate errors
      throw e
    }
  }

  const sendStatefulTransaction = async (fiat: any, action: string, contract: ethers.Contract, method: string, ...args: any[]) => {
    try {
      setTransactionData({ action, status: 'sent' });
      const resp = await fiat.sendAndWait(contract, method, ...args);
      setTransactionData(initialState.transactionData);
      return resp;
    } catch (e) {
      console.error('Error: ', e);
      setTransactionData({ ...transactionData, status: 'error' });
      // Should be caught by caller to set appropriate errors
      throw e
    }
  }

  const createProxy = async (fiat: any, user: string) => {
    // return await dryRun(fiat, 'createProxy', fiat.getContracts().proxyRegistry, 'deployFor', user);
    const response = await sendStatefulTransaction(fiat, 'createProxy', fiat.getContracts().proxyRegistry, 'deployFor', user);
    addRecentTransaction({
      hash: response.transactionHash,
      description: 'Create Proxy',
    });
    // Querying chain directly after this to update as soon as possible
    const { proxyRegistry } = fiat.getContracts();
    const proxyAddress = await fiat.call(
      proxyRegistry,
      'getCurrentProxy',
      user,
    );
    setContextData({ ...contextData, proxies: [proxyAddress] });
  }

  const setUnderlierAllowance = async (fiat: any) => {
    const token = fiat.getERC20Contract(modifyPositionData.collateralType.properties.underlierToken);
    // add 1 unit has a buffer in case user refreshes the page and the value becomes outdated
    const allowance = formDataStore.underlier.add(modifyPositionData.collateralType.properties.underlierScale);
    // return await dryRun(fiat, 'setUnderlierAllowance', token, 'approve', contextData.proxies[0], allowance);
    const response = await sendStatefulTransaction(fiat, 'setUnderlierAllowance', token, 'approve', contextData.proxies[0], allowance);
    addRecentTransaction({
      hash: response.transactionHash,
      description: 'Set Allowance',
    });
    const underlierAllowance = await token.allowance(contextData.user, contextData.proxies[0])
    setModifyPositionData({ ...modifyPositionData, underlierAllowance });
  }

  const unsetUnderlierAllowance = async (fiat: any) => {
    const token = fiat.getERC20Contract(modifyPositionData.collateralType.properties.underlierToken);
    // return await dryRun(fiat, 'unsetUnderlierAllowance', token, 'approve', contextData.proxies[0], 0);
    const response =  await sendStatefulTransaction(fiat, 'unsetUnderlierAllowance', token, 'approve', contextData.proxies[0], 0);
    addRecentTransaction({
      hash: response.transactionHash,
      description: 'Set Allowance',
    });
    return response;
  }

  const setFIATAllowance = async (fiat: any) => {
    const token = fiat.getContracts().fiat;
    // add 1 unit has a buffer in case user refreshes the page and the value becomes outdated
    const allowance = formDataStore.deltaDebt.add(WAD);
    // return await dryRun(fiat, 'setFIATAllowance', token, 'approve', contextData.proxies[0], allowance);
    const response = await sendStatefulTransaction(fiat, 'setFIATAllowance', token, 'approve', contextData.proxies[0], allowance);
    addRecentTransaction({
      hash: response.transactionHash,
      description: 'Set Allowance',
    });
    const fiatAllowance = await token.allowance(contextData.user, contextData.proxies[0])
    setModifyPositionData({ ...modifyPositionData, fiatAllowance });
  }

  const unsetFIATAllowance = async (fiat: any) => {
    const token = fiat.getContracts().fiat;
    // return await dryRun(fiat, 'unsetFIATAllowance', token, 'approve', contextData.proxies[0], 0);
    const response =  await sendStatefulTransaction(fiat, 'unsetFIATAllowance', token, 'approve', contextData.proxies[0], 0);
    addRecentTransaction({
      hash: response.transactionHash,
      description: 'Set Allowance',
    });
    return response;
  }

  const setMonetaDelegate = async (fiat: any) => {
    const { codex, moneta } = fiat.getContracts();
    // return await dryRun(fiat, 'setMonetaDelegate', codex, 'grantDelegate', moneta.address);
    const response = await sendStatefulTransaction(fiat, 'setMonetaDelegate', codex, 'grantDelegate', moneta.address);
    addRecentTransaction({
      hash: response.transactionHash,
      description: 'Set Allowance',
    });

    const monetaDelegate = await fiat.call(
      codex,
      'delegates',
      contextData.proxies[0],
      moneta.address,
    );
    setModifyPositionData({ ...modifyPositionData, monetaDelegate });
  }

  const unsetMonetaDelegate = async (fiat: any) => {
    const { codex, moneta } = fiat.getContracts();
    // return await dryRun(fiat, 'unsetMonetaDelegate', codex, 'revokeDelegate', moneta.address);
    const response = await sendStatefulTransaction(fiat, 'unsetMonetaDelegate', codex, 'revokeDelegate', moneta.address);
    addRecentTransaction({
      hash: response.transactionHash,
      description: 'Set Allowance',
    });
    return response;
  }

  const buyCollateralAndModifyDebt = async () => {
    setTransactionData({ status: 'sent', action: 'buyCollateralAndModifyDebt' });
    try {
      if (formDataStore.deltaCollateral.isZero()) {
        const resp = await userActions.modifyCollateralAndDebt(
          contextData,
          modifyPositionData.collateralType,
          formDataStore.deltaDebt, // increase (mint)
          modifyPositionData.position,
        ) as any;
        addRecentTransaction({
          hash: resp.transactionHash,
          description: 'Modify Collateral and Debt',
        });
        handleFinishedTransaction();
        return resp;
      } else {
        const resp = await userActions.buyCollateralAndModifyDebt(
          contextData,
          modifyPositionData.collateralType,
          formDataStore.deltaCollateral,
          formDataStore.deltaDebt,
          formDataStore.underlier
        ) as any;
        addRecentTransaction({
          hash: resp.transactionHash,
          description: 'Buy Collateral And Modify Debt',
        });

        handleFinishedTransaction();
        return resp;
      }
    } catch (e) {
      console.error('Buy error: ', e);
      setTransactionData({ ...transactionData, status: 'error' });
      throw e;
    }
  }

  const sellCollateralAndModifyDebt = async () => {
    setTransactionData({ status: 'sent', action: 'sellCollateralAndModifyDebt' });
    try {
      if (formDataStore.deltaCollateral.isZero()) {
        const resp = await userActions.modifyCollateralAndDebt(
          contextData,
          modifyPositionData.collateralType,
          formDataStore.deltaDebt.mul(-1), // decrease (pay back)
          modifyPositionData.position,
        ) as any;
        addRecentTransaction({
          hash: resp.transactionHash,
          description: 'Modify Collateral and Debt',
        });
        handleFinishedTransaction();
        return resp;
      }
      else {
        const resp = await userActions.sellCollateralAndModifyDebt(
          contextData,
          modifyPositionData.collateralType,
          formDataStore.deltaCollateral,
          formDataStore.deltaDebt,
          formDataStore.underlier,
          modifyPositionData.position,
        ) as any;
        addRecentTransaction({
          hash: resp.transactionHash,
          description: 'Sell Collateral and Modify Debt',
        });
        handleFinishedTransaction();
        return resp;
      }
    } catch (e) {
      console.error('Sell error: ', e);
      setTransactionData({ ...transactionData, status: 'error' });
      throw e;
    }
  }

  const redeemCollateralAndModifyDebt = async () => {
    setTransactionData({ status: 'sent', action: 'redeemCollateralAndModifyDebt' });
    try {
      if (formDataStore.deltaCollateral.isZero()) {
        const resp = await userActions.modifyCollateralAndDebt(
          contextData,
          modifyPositionData.collateralType,
          formDataStore.deltaDebt.mul(-1), // decrease (pay back)
          modifyPositionData.position,
        ) as any;
        addRecentTransaction({
          hash: resp.transactionHash,
          description: 'Modify Collateral and Debt',
        });
        handleFinishedTransaction();
        return resp;
      }
      else {
        const resp = await userActions.redeemCollateralAndModifyDebt(
          contextData,
          modifyPositionData.collateralType,
          formDataStore.deltaCollateral,
          formDataStore.deltaDebt,
          modifyPositionData.position,
        ) as any;
        addRecentTransaction({
          hash: resp.transactionHash,
          description: 'Redeem',
        });
        handleFinishedTransaction();
        return resp;
      }
    } catch (e) {
      console.error('Redeem error: ', e);
      setTransactionData({ ...transactionData, status: 'error' });
      throw e;
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12 }}>
        <h3 style={{ justifyContent: 'flex',  }}>(Experimental) FIAT I UI</h3>
        <div style={{ display: 'flex', height: '40px'}}>
          <Button 
            auto
            icon={<InfoIcon fillColor='var(--rk-colors-connectButtonText)'/>}
            css={connectButtonCSS}
            onPress={()=>setShowInfoModal(true)}
          />
          <ProxyButton
            {...contextData}
            createProxy={createProxy}
            disableActions={disableActions}
            transactionData={transactionData}
          />
          {(fiatBalance) && 
            <Badge 
              css={connectButtonCSS}
            >
              {fiatBalance}
            </Badge>
          }
          <div className='connectWrapper'>
            <ConnectButton showBalance={false} />
          </div>
        </div>
      </div>
      <Spacer y={2} />
      <Container>
        {
          positionsData === null || positionsData.length === 0
            ? null
            : (
              <PositionsTable
                contextData={contextData}
                collateralTypesData={collateralTypesData}
                positionsData={positionsData}
                onSelectPosition={(positionId) => {
                  setSelectedPositionId(positionId);
                  setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
                }}
              />
            )
        }
      </Container>
      <Spacer y={2} />
      <Container>
        <CollateralTypesTable
          collateralTypesData={collateralTypesData}
          positionsData={positionsData}
          onSelectCollateralType={(collateralTypeId) => {
            // If user has an existing position for the collateral type then open ModifyPositionModal instead
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

      <CreatePositionModal
        buyCollateralAndModifyDebt={buyCollateralAndModifyDebt}
        contextData={contextData}
        disableActions={disableActions}
        modifyPositionData={modifyPositionData}
        selectedCollateralTypeId={selectedCollateralTypeId}
        setMonetaDelegate={setMonetaDelegate}
        setUnderlierAllowance={setUnderlierAllowance}
        transactionData={transactionData}
        unsetMonetaDelegate={unsetMonetaDelegate}
        unsetUnderlierAllowance={unsetUnderlierAllowance}
        open={(!!selectedCollateralTypeId && !!modifyPositionData)}
        onClose={() => {
          setSelectedCollateralTypeId(initialState.selectedCollateralTypeId);
          setModifyPositionData(initialState.modifyPositionData);
          formDataStore.reset();
        }}
      />

      <ModifyPositionModal
        buyCollateralAndModifyDebt={buyCollateralAndModifyDebt}
        contextData={contextData}
        disableActions={disableActions}
        modifyPositionData={modifyPositionData}
        redeemCollateralAndModifyDebt={redeemCollateralAndModifyDebt}
        sellCollateralAndModifyDebt={sellCollateralAndModifyDebt}
        setFIATAllowance={setFIATAllowance}
        setTransactionStatus={(status) =>
          setTransactionData({ ...transactionData, status })
        }
        setMonetaDelegate={setMonetaDelegate}
        setUnderlierAllowance={setUnderlierAllowance}
        transactionData={transactionData}
        unsetFIATAllowance={unsetFIATAllowance}
        unsetMonetaDelegate={unsetMonetaDelegate}
        unsetUnderlierAllowance={unsetUnderlierAllowance}
        open={(!!selectedPositionId)}
        onClose={() => {
          setSelectedPositionId(initialState.selectedCollateralTypeId);
          setModifyPositionData(initialState.modifyPositionData);
          formDataStore.reset();
        }}
      />

      <InfoModal 
        open={showInfoModal}
        onClose={() => setShowInfoModal(false)}
      />
      <Spacer />
    </div>
  );
};

export default Home;
