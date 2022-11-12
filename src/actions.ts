import { decToWad, scaleToWad, WAD, wadToScale, ZERO } from '@fiatdao/sdk';
import { ethers } from 'ethers';

export const underlierToBondToken = async (
  fiat: any,
  underlier: ethers.BigNumber,
  collateralType: any
): Promise<ethers.BigNumber> => {
  if (!underlier.gt(ZERO)) {
    return ZERO;
  }

  const { vault, tokenId, vaultType } = collateralType.properties;
  const { vaultEPTActions, vaultFCActions, vaultFYActions } =
    fiat.getContracts();

  switch (vaultType) {
    case 'ERC20:EPT': {
      if (collateralType.properties.eptData == undefined)
        throw new Error('Missing data');
      const {
        eptData: { balancerVault: balancer, poolId: pool },
      } = collateralType.properties;
      const tokensOut = await fiat.call(
        vaultEPTActions,
        'underlierToPToken',
        vault,
        balancer,
        pool,
        underlier
      );
      return tokensOut;
    }
    case 'ERC1155:FC': {
      if (collateralType.properties.fcData == undefined)
        throw new Error('Missing data');
      const tokensOut = await fiat.call(
        vaultFCActions,
        'underlierToFCash',
        tokenId,
        underlier
      );
      return tokensOut;
    }
    case 'ERC20:FY': {
      if (collateralType.properties.fyData == undefined)
        throw new Error('Missing data');
      const {
        fyData: { yieldSpacePool },
      } = collateralType.properties;
      const tokensOut = await fiat.call(
        vaultFYActions,
        'underlierToFYToken',
        underlier,
        yieldSpacePool
      );
      return tokensOut;
    }
    default: {
      throw new Error('Unsupported collateral type');
    }
  }
};

export const bondTokenToUnderlier = async (
  fiat: any,
  tokenIn: ethers.BigNumber,
  collateralType: any
): Promise<ethers.BigNumber> => {
  if (tokenIn.gt(ZERO)) {
    return ZERO;
  }

  const { vault, tokenId, vaultType } = collateralType.properties;
  const { vaultEPTActions, vaultFCActions, vaultFYActions } =
    fiat.getContracts();

  switch (vaultType) {
    case 'ERC20:EPT': {
      if (collateralType.properties.eptData == undefined)
        throw new Error('Missing data');
      const {
        eptData: { balancerVault: balancer, poolId: pool },
      } = collateralType.properties;
      const underlierAmount = await fiat.call(
        vaultEPTActions,
        'pTokenToUnderlier',
        vault,
        balancer,
        pool,
        tokenIn
      );
      return underlierAmount;
    }

    case 'ERC1155:FC': {
      if (collateralType.properties.fcData == undefined)
        throw new Error('Missing data');
      const underlierAmount = await fiat.call(
        vaultFCActions,
        'fCashToUnderlier',
        tokenId,
        tokenIn
      );
      return underlierAmount;
    }

    case 'ERC20:FY': {
      if (collateralType.properties.fyData == undefined)
        throw new Error('Missing data');
      const {
        fyData: { yieldSpacePool },
      } = collateralType.properties;
      const underlierAmount = await fiat.call(
        vaultFYActions,
        'fyTokenToUnderlier',
        tokenIn,
        yieldSpacePool
      );
      return underlierAmount;
    }
    default:
      throw new Error('Unsupported collateral type');
  }
};

export const getEarnableRate = async (fiat: any, collateralTypesData: any) => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions } = fiat.getContracts();
  const queries = collateralTypesData.flatMap((collateralTypeData: any) => {
    const { properties } = collateralTypeData;
    const { vault, tokenId, vaultType, tokenScale, underlierScale, maturity } = properties;
    if (new Date() >= new Date(Number(maturity.toString()) * 1000)) return [];
    switch (vaultType) {
      case 'ERC20:EPT': {
        if (!properties.eptData) return console.error('Missing EPT data');
        const { balancerVault, poolId } = properties.eptData;
        return {
          vault,
          tokenScale,
          call: {
            contract: vaultEPTActions, method: 'underlierToPToken', args: [vault, balancerVault, poolId, underlierScale]
          }
        };
      }
      case 'ERC1155:FC': {
        if (!properties.fcData) return console.error('Missing FC data');
        return {
          vault,
          tokenScale,
          call: {
            contract: vaultFCActions, method: 'underlierToFCash', args: [tokenId, underlierScale]
          }
        };
      }
      case 'ERC20:FY': {
        if (!properties.fyData) return console.error('Missing FY data');
        const { yieldSpacePool } = properties.fyData;
        return {
          vault,
          tokenScale,
          call: {
            contract: vaultFYActions, method: 'underlierToFYToken', args: [underlierScale, yieldSpacePool]
          }
        };
      }
      default: {
        throw new Error('Unsupported vault type: ', properties.vaultType);
      }
    }
  });
  const results = await fiat.multicall(queries.map((query: any) => query.call));
  return results.map((result: any, index: number) => {
    return {
      vault: queries[index].vault, earnableRate: scaleToWad(result, queries[index].tokenScale).sub(WAD)
    };
  });
};

export const buyCollateralAndModifyDebt = async (
  contextData: any,
  // TODO avoid null checks on properties.<vaultName>Data with a typecheck here
  collateralTypeData: any,
  deltaCollateral: ethers.BigNumber,
  deltaDebt: ethers.BigNumber,
  underlier: ethers.BigNumber,
) => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions } =
    contextData.fiat.getContracts();
  const { properties } = collateralTypeData;

  const normalDebt = contextData.fiat
    .debtToNormalDebt(
      deltaDebt,
      collateralTypeData.state.codex.virtualRate
    )
    .mul(WAD.sub(decToWad(0.001)))
    .div(WAD);
  const tokenAmount = wadToScale(
    deltaCollateral,
    properties.tokenScale
  );

  switch (properties.vaultType) {
    case 'ERC20:EPT': {
      if (!properties.eptData) {
        console.error('Missing EPT data');
        return;
      }

      const deadline = Math.round(+new Date() / 1000) + 3600;

      // const resp = await contextData.fiat.dryrunViaProxy(
      const resp = await contextData.fiat.sendAndWaitViaProxy(
        contextData.proxies[0],
        vaultEPTActions,
        'buyCollateralAndModifyDebt',
        properties.vault,
        contextData.proxies[0],
        contextData.user,
        contextData.user,
        underlier,
        normalDebt,
        [
          properties.eptData.balancerVault,
          properties.eptData.poolId,
          properties.underlierToken,
          properties.token,
          tokenAmount,
          deadline,
          underlier,
        ]
      )
      console.log(resp);
      break;
    }

    case 'ERC1155:FC': {
      if (!properties.fcData) {
        console.error('Missing FC data');
        return;
      }

      // 1 - (underlier / deltaCollateral)
      const minLendRate = wadToScale(
        WAD.sub(
          scaleToWad(
            underlier,
            properties.underlierScale
          )
            .mul(WAD)
            .div(deltaCollateral)
        ),
        properties.tokenScale
      );

      // const resp = await contextData.fiat.dryrunViaProxy(
      const resp = await contextData.fiat.sendAndWaitViaProxy(
        contextData.proxies[0],
        vaultFCActions,
        'buyCollateralAndModifyDebt',
        properties.vault,
        properties.token,
        properties.tokenId,
        contextData.proxies[0],
        contextData.user,
        contextData.user,
        tokenAmount,
        normalDebt,
        minLendRate,
        underlier
      )
      console.log(resp);
      break;
    }

    case 'ERC20:FY': {
      if (!properties.fyData) {
        console.error('Missing FY data');
        return;
      }

      // const resp = await contextData.fiat.dryrunViaProxy(
      const resp = await contextData.fiat.sendAndWaitViaProxy(
        contextData.proxies[0],
        vaultFYActions,
        'buyCollateralAndModifyDebt',
        properties.vault,
        contextData.proxies[0],
        contextData.user,
        contextData.user,
        tokenAmount,
        normalDebt,
        [
          underlier,
          properties.fyData.yieldSpacePool,
          properties.token,
          properties.underlierToken,
        ]
      );
      console.log('resp: ', resp);
      break;
    }

    default: {
      console.error('Unsupported vault: ', properties.vaultType);
    }
  }
};

export const sellCollateralAndModifyDebt = async (
  contextData: any,
  collateralTypeData: any,
  deltaCollateral: ethers.BigNumber,
  deltaDebt: ethers.BigNumber,
  underlier: ethers.BigNumber,
) => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions } =
    contextData.fiat.getContracts();
  const { properties } = collateralTypeData;

  const normalDebt = contextData.fiat
    .debtToNormalDebt(
      deltaDebt,
      collateralTypeData.state.codex.virtualRate
    )
    .mul(WAD.sub(decToWad(0.001)))
    .div(WAD);
  const tokenAmount = wadToScale(
    deltaCollateral,
    properties.tokenScale
  );

  switch (properties.vaultType) {
    case 'ERC20:EPT': {
      if (!properties.eptData) {
        console.error('Missing EPT data');
        return;
      }

      const deadline = Math.round(+new Date() / 1000) + 3600;

      // const resp = await contextData.fiat.dryrunViaProxy(
      const resp = await contextData.fiat.sendAndWaitViaProxy(
        contextData.proxies[0],
        vaultEPTActions,
        'sellCollateralAndModifyDebt',
        properties.vault,
        contextData.proxies[0],
        contextData.user,
        contextData.user,
        tokenAmount,
        normalDebt,
        [
          properties.eptData.balancerVault,
          properties.eptData.poolId,
          properties.token,
          properties.underlierToken,
          underlier,
          deadline,
          tokenAmount,
        ]
      );
      console.log('resp: ', resp);
      break;
    }

    case 'ERC1155:FC': {
      if (!properties.fcData) {
        console.error('Missing FC data');
        return;
      }

      const maxBorrowRate = wadToScale(
        WAD.sub(
          deltaCollateral
            .mul(WAD)
            .div(
              scaleToWad(
                underlier,
                properties.underlierScale
              )
            )
        ),
        properties.tokenScale
      );

      // const resp = await contextData.fiat.dryrunViaProxy(
      const resp = await contextData.fiat.sendAndWaitViaProxy(
        contextData.proxies[0],
        vaultFCActions,
        'sellCollateralAndModifyDebt',
        properties.vault,
        properties.token,
        properties.tokenId,
        contextData.proxies[0],
        contextData.user,
        contextData.user,
        tokenAmount,
        normalDebt,
        maxBorrowRate
      );
      console.log('resp: ', resp);
      break;
    }

    case 'ERC20:FY': {
      if (!properties.fyData) {
        console.error('Missing FY data');
        return;
      }

      // const resp = await contextData.fiat.dryrunViaProxy(
      const resp = await contextData.fiat.sendAndWaitViaProxy(
        contextData.proxies[0],
        vaultFYActions,
        'sellCollateralAndModifyDebt',
        properties.vault,
        contextData.proxies[0],
        contextData.user,
        contextData.user,
        tokenAmount,
        normalDebt,
        [
          underlier,
          properties.fyData.yieldSpacePool,
          properties.token,
          properties.underlierToken,
        ]
      );
      console.log('resp: ', resp);
      break;
    }

    default: {
      console.error('Unsupported vault: ', properties.vaultType);
    }
  }
};

export const redeemCollateralAndModifyDebt = async (
  contextData: any,
  collateralTypeData: any,
  deltaCollateral: ethers.BigNumber,
  deltaDebt: ethers.BigNumber,
) => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions } =
    contextData.fiat.getContracts();
  const { properties } = collateralTypeData;

  const normalDebt = contextData.fiat
    .debtToNormalDebt(
      deltaDebt,
      collateralTypeData.state.codex.virtualRate
    )
    .mul(WAD.sub(decToWad(0.001)))
    .div(WAD);
  const tokenAmount = wadToScale(
    deltaCollateral,
    properties.tokenScale
  );

  switch (properties.vaultType) {
    case 'ERC20:EPT': {
      if (!properties.eptData) {
        console.error('Missing EPT data');
        return;
      }

      // const resp = await contextData.fiat.dryrunViaProxy(
      const resp = await contextData.fiat.sendAndWaitViaProxy(
        contextData.proxies[0],
        vaultEPTActions,
        'redeemCollateralAndModifyDebt',
        properties.vault,
        properties.token,
        contextData.proxies[0],
        contextData.user,
        contextData.user,
        tokenAmount,
        normalDebt
      );
      console.log('resp: ', resp);
      break;
    }

    case 'ERC1155:FC': {
      if (!properties.fcData) {
        console.error('Missing FC data');
        return;
      }

      // const resp = await contextData.fiat.dryrunViaProxy(
      const resp = await contextData.fiat.sendAndWaitViaProxy(
        contextData.proxies[0],
        vaultFCActions,
        'redeemCollateralAndModifyDebt',
        properties.vault,
        properties.token,
        properties.tokenId,
        contextData.proxies[0],
        contextData.user,
        contextData.user,
        tokenAmount,
        normalDebt
      );
      console.log('resp: ', resp);
      break;
    }

    case 'ERC20:FY': {
      if (!properties.fyData) {
        console.error('Missing FY data');
        return;
      }

      // const resp = await contextData.fiat.dryrunViaProxy(
      const resp = await contextData.fiat.sendAndWaitViaProxy(
        contextData.proxies[0],
        vaultFYActions,
        'redeemCollateralAndModifyDebt',
        properties.vault,
        properties.token,
        contextData.proxies[0],
        contextData.user,
        contextData.user,
        tokenAmount,
        normalDebt
      );
      console.log('resp: ', resp);
      break;
    }

    default: {
      console.error('Unsupported vault: ', properties.vaultType);
    }
  }
};

// TODO: maybe implement modifyCollateralAndDebt()? or just delete it - underlier actions only is kinda nice
