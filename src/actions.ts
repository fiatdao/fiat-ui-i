import { debtToNormalDebt, decToWad, scaleToWad, WAD, wadToScale, ZERO } from '@fiatdao/sdk';
import { BigNumber, Contract } from 'ethers';

export const underlierToCollateralToken = async (
  fiat: any,
  underlier: BigNumber,
  collateralType: any
): Promise<BigNumber> => {
  if (underlier.isZero()) return ZERO;

  const { vault, tokenId, vaultType } = collateralType.properties;
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = fiat.getContracts();
  switch (vaultType) {
    case 'ERC20:EPT': {
      if (collateralType.properties.eptData == undefined) throw new Error('Missing EPT data');
      const { eptData: { balancerVault: balancer, poolId: pool } } = collateralType.properties;
      return await fiat.call(
        vaultEPTActions,
        'underlierToPToken',
        vault,
        balancer,
        pool,
        underlier
      );
    }
    case 'ERC1155:FC': {
      if (collateralType.properties.fcData == undefined) throw new Error('Missing FC data');
      return await fiat.call(
        vaultFCActions,
        'underlierToFCash',
        tokenId,
        underlier
      );
    }
    case 'ERC20:FY': {
      if (collateralType.properties.fyData == undefined) throw new Error('Missing FY data');
      const { fyData: { yieldSpacePool } } = collateralType.properties;
      return await fiat.call(
        vaultFYActions,
        'underlierToFYToken',
        underlier,
        yieldSpacePool
      );
    }
    case 'ERC20:SPT': {
      if (collateralType.properties.sptData == undefined) throw new Error('Missing SPT data');
      const { sptData: { spacePool, balancerVault } } = collateralType.properties;
      return await fiat.call(
        vaultSPTActions,
        'underlierToPToken',
        spacePool,
        balancerVault,
        underlier
      );
    }
    default: {
      throw new Error('Unsupported collateral type');
    }
  }
};

export const collateralTokenToUnderlier = async (
  fiat: any,
  collateral: BigNumber,
  collateralType: any
): Promise<BigNumber> => {
  if (collateral.isZero()) return ZERO;
  const { vault, tokenId, vaultType } = collateralType.properties;
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = fiat.getContracts();

  switch (vaultType) {
    case 'ERC20:EPT': {
      if (collateralType.properties.eptData == undefined) throw new Error('Missing EPT data');
      const { eptData: { balancerVault: balancer, poolId: pool } } = collateralType.properties;
      return await fiat.call(
        vaultEPTActions,
        'pTokenToUnderlier',
        vault,
        balancer,
        pool,
        collateral
      );
    }
    case 'ERC1155:FC': {
      if (collateralType.properties.fcData == undefined) throw new Error('Missing FC data');
      return await fiat.call(
        vaultFCActions,
        'fCashToUnderlier',
        tokenId,
        collateral
      );
    }
    case 'ERC20:FY': {
      if (collateralType.properties.fyData == undefined) throw new Error('Missing FY data');
      const { fyData: { yieldSpacePool } } = collateralType.properties;
      return await fiat.call(
        vaultFYActions,
        'fyTokenToUnderlier',
        collateral,
        yieldSpacePool
      );
    }
    case 'ERC20:SPT': {
      if (collateralType.properties.sptData == undefined) throw new Error('Missing SPT data');
      const { sptData: { spacePool, balancerVault } } = collateralType.properties;
      return await fiat.call(
        vaultSPTActions,
        'pTokenToUnderlier',
        spacePool,
        balancerVault,
        collateral
      );
    }
    default:
      throw new Error('Unsupported collateral type');
  }
};

export const getEarnableRate = async (fiat: any, collateralTypesData: any) => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = fiat.getContracts();
  const queries = collateralTypesData.flatMap((collateralTypeData: any) => {
    const { properties } = collateralTypeData;
    const { vault, tokenId, vaultType, tokenScale, underlierScale, maturity } = properties;
    if (new Date() >= new Date(Number(maturity.toString()) * 1000)) return [];
    switch (vaultType) {
      case 'ERC20:EPT': {
        if (!properties.eptData) throw new Error('Missing EPT data');
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
        if (!properties.fcData) throw new Error('Missing FC data');
        return {
          vault,
          tokenScale,
          call: {
            contract: vaultFCActions, method: 'underlierToFCash', args: [tokenId, underlierScale]
          }
        };
      }
      case 'ERC20:FY': {
        if (!properties.fyData) throw new Error('Missing FY data');
        const { yieldSpacePool } = properties.fyData;
        return {
          vault,
          tokenScale,
          call: {
            contract: vaultFYActions, method: 'underlierToFYToken', args: [underlierScale, yieldSpacePool]
          }
        };
      }
      case 'ERC20:SPT': {
        if (!properties.sptData) throw new Error('Missing SPT data');
        const { spacePool, balancerVault } = properties.sptData;
        return {
          vault,
          tokenScale,
          call: {
            contract: vaultSPTActions, method: 'underlierToPToken', args: [spacePool, balancerVault, underlierScale]
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

// decreases deltaNormalDebt to compensate for the interest that has accrued
// between when the tx is sent vs. when it is confirmed
// insure that: debt_sent = normalDebt * rate_send <= debt_mined = normalDebt * rate_mined, otherwise:
// avoids that user does not take out more debt than expected, that FIAT approval might not be sufficient for repayment
const addDeltaNormalBuffer = (deltaNormalDebt: BigNumber): BigNumber => {
  return deltaNormalDebt.mul(WAD.sub(decToWad(0.0001))).div(WAD);
}

export const buildModifyCollateralAndDebtArgs = (
  contextData: any,
  collateralTypeData: any,
  deltaDebt: BigNumber,
  position: { collateral: BigNumber, normalDebt: BigNumber }
): { contract: Contract, methodName: string, methodArgs: any[] } => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = contextData.fiat.getContracts();
  const { properties } = collateralTypeData;

  let deltaNormalDebt = addDeltaNormalBuffer(
    debtToNormalDebt(deltaDebt, collateralTypeData.state.codex.virtualRate
  ));
  if (position.normalDebt.add(deltaNormalDebt).lt(WAD)) deltaNormalDebt = position.normalDebt.mul(-1);

  // if deltaCollateral is zero use generic modifyCollateralAndDebt method since no swap is necessary
  let actionsContract;
  if (properties.vaultType === 'ERC20:EPT') actionsContract = vaultEPTActions;
  if (properties.vaultType === 'ERC1155:FC') actionsContract = vaultFCActions;
  if (properties.vaultType === 'ERC20:FY') actionsContract = vaultFYActions;
  if (properties.vaultType === 'ERC20:SPT') actionsContract = vaultSPTActions;

  const args = {
    contract: actionsContract,
    methodName: 'modifyCollateralAndDebt',
    methodArgs: [
      properties.vault,
      properties.token,
      properties.tokenId,
      contextData.proxies[0],
      contextData.user,
      contextData.user,
      ZERO,
      deltaNormalDebt,
    ],
  };
  return args;
}

export const buildBuyCollateralAndModifyDebtArgs = (
  contextData: any,
  collateralTypeData: any,
  deltaCollateral: BigNumber,
  deltaDebt: BigNumber,
  underlier: BigNumber
): { contract: Contract, methodName: string, methodArgs: any[] } => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = contextData.fiat.getContracts();
  const { properties } = collateralTypeData;

  const deltaNormalDebt = addDeltaNormalBuffer(
    debtToNormalDebt(deltaDebt, collateralTypeData.state.codex.virtualRate
  ));
  const tokenAmount = wadToScale(deltaCollateral, properties.tokenScale);

  // if deltaCollateral is zero use generic modifyCollateralAndDebt method since no swap is necessary
  if (deltaCollateral.isZero()) throw new Error('Invalid value for `deltaCollateral` - Value has to be non-zero');

  switch (properties.vaultType) {
    case 'ERC20:EPT': {
      if (!properties.eptData) throw new Error('Missing EPT data');
      const deadline = Math.round(+new Date() / 1000) + 3600;
      const args = {
        contract: vaultEPTActions,
        methodName: 'buyCollateralAndModifyDebt',
        methodArgs: [
          properties.vault,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          underlier,
          deltaNormalDebt,
          [
            properties.eptData.balancerVault,
            properties.eptData.poolId,
            properties.underlierToken,
            properties.token,
            tokenAmount,
            deadline,
            underlier,
          ]
        ],
      };
      return args;
    }
    case 'ERC1155:FC': {
      if (!properties.fcData) throw new Error('Missing FC data');
      // 1 - (underlier / deltaCollateral)
      const minLendRate = wadToScale(
        WAD.sub(scaleToWad(underlier, properties.underlierScale).mul(WAD).div(deltaCollateral)),
        properties.tokenScale
      );
      const args = {
        contract: vaultFCActions,
        methodName: 'buyCollateralAndModifyDebt',
        methodArgs: [
          properties.vault,
          properties.token,
          properties.tokenId,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          deltaNormalDebt,
          minLendRate,
          underlier
        ],
      };
      return args;
    }
    case 'ERC20:FY': {
      if (!properties.fyData) throw new Error('Missing FY data');
      const args = {
        contract: contextData,
        methodName: vaultFYActions,
        methodArgs: [
          'buyCollateralAndModifyDebt',
          properties.vault,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          underlier,
          deltaNormalDebt,
          [
            tokenAmount,
            properties.fyData.yieldSpacePool,
            properties.underlierToken,
            properties.token
          ]
        ],
      };
      return args;
    }
    case 'ERC20:SPT': {
      if (!properties.sptData) throw new Error('Missing SPT data');
      const args = {
        contract: contextData,
        methodName: vaultSPTActions,
        methodArgs: [
          'buyCollateralAndModifyDebt',
          properties.vault,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          underlier,
          deltaNormalDebt,
          [
            properties.sptData.adapter,
            tokenAmount,
            properties.sptData.maturity,
            properties.underlierToken,
            properties.token,
            underlier
          ]
        ],
      };
      return args;
    }
    default: {
      throw new Error('Unsupported vault: ', properties.vaultType);
    }
  }
};

export const buildSellCollateralAndModifyDebtArgs = (
  contextData: any,
  collateralTypeData: any,
  deltaCollateral: BigNumber,
  deltaDebt: BigNumber,
  underlier: BigNumber,
  position: any
): { contract: Contract, methodName: string, methodArgs: any[] } => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = contextData.fiat.getContracts();
  const { properties } = collateralTypeData;

  let deltaNormalDebt = addDeltaNormalBuffer(
    debtToNormalDebt(deltaDebt, collateralTypeData.state.codex.virtualRate
  ));
  if (position.normalDebt.sub(deltaNormalDebt).lt(WAD)) deltaNormalDebt = position.normalDebt;
  deltaNormalDebt = deltaNormalDebt.mul(-1);

  const tokenAmount = wadToScale(deltaCollateral, properties.tokenScale);

  // if deltaCollateral is zero use generic modifyCollateralAndDebt method since no swap is necessary
  if (deltaCollateral.isZero()) throw new Error('Invalid value for `deltaCollateral` - Value has to be non-zero');

  switch (properties.vaultType) {
    case 'ERC20:EPT': {
      if (!properties.eptData) throw new Error('Missing EPT data');
      const deadline = Math.round(+new Date() / 1000) + 3600;
      // await contextData.fiat.dryrunViaProxy(
      const args = {
        contract: vaultEPTActions,
        methodName: 'sellCollateralAndModifyDebt',
        methodArgs: [
          properties.vault,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          deltaNormalDebt,
          [
            properties.eptData.balancerVault,
            properties.eptData.poolId,
            properties.token,
            properties.underlierToken,
            underlier,
            deadline,
            tokenAmount
          ]
        ]
      };
      return args;
    }

    case 'ERC1155:FC': {
      if (!properties.fcData) throw new Error('Missing FC data');
      const maxBorrowRate = wadToScale(
        WAD.sub(deltaCollateral.mul(WAD).div(scaleToWad(underlier, properties.underlierScale))),
        properties.tokenScale
      );
      // await contextData.fiat.dryrunViaProxy(
      const args = {
        contract: vaultFCActions,
        methodName: 'sellCollateralAndModifyDebt',
        methodArgs: [
          properties.vault,
          properties.token,
          properties.tokenId,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          deltaNormalDebt,
          maxBorrowRate
        ]
      };
      return args;
    }
    case 'ERC20:FY': {
      if (!properties.fyData) throw new Error('Missing FY data');
      // await contextData.fiat.dryrunViaProxy(
      const args = {
        contract: vaultFYActions,
        methodName: 'sellCollateralAndModifyDebt',
        methodArgs: [
          properties.vault,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          deltaNormalDebt,
          [
            underlier,
            properties.fyData.yieldSpacePool,
            properties.token,
            properties.underlierToken,
          ]
        ]
      };
      return args;
    }
    case 'ERC20:SPT': {
      if (!properties.sptData) throw new Error('Missing SPT data');
      // await contextData.fiat.dryrunViaProxy(
      const args = {
        contract: vaultSPTActions,
        methodName: 'sellCollateralAndModifyDebt',
        methodArgs: [
          properties.vault,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          deltaNormalDebt,
          [
            properties.sptData.adapter,
            underlier,
            properties.sptData.maturity,
            properties.token,
            properties.underlierToken,
            tokenAmount,
          ]
        ]
      };
      return args;
    }
    default: {
      throw new Error('Unsupported vault: ', properties.vaultType);
    }
  }
};

export const buildRedeemCollateralAndModifyDebtArgs = (contextData: any,
  collateralTypeData: any,
  deltaCollateral: BigNumber,
  deltaDebt: BigNumber,
  position: any
): { contract: Contract, methodName: string, methodArgs: any[] } => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = contextData.fiat.getContracts();
  const { properties } = collateralTypeData;

  let deltaNormalDebt = debtToNormalDebt(deltaDebt, collateralTypeData.state.codex.virtualRate)
    .mul(WAD.sub(decToWad(0.001)))
    .div(WAD);
  if (position.normalDebt.sub(deltaNormalDebt).lt(WAD)) deltaNormalDebt = position.normalDebt;
  deltaNormalDebt = deltaNormalDebt.mul(-1);

  const tokenAmount = wadToScale(deltaCollateral, properties.tokenScale);

  switch (properties.vaultType) {
    case 'ERC20:EPT': {
      if (!properties.eptData) throw new Error('Missing EPT data');
      const args = {
        contract: vaultEPTActions,
        methodName: 'redeemCollateralAndModifyDebt',
        methodArgs: [
          properties.vault,
          properties.token,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          deltaNormalDebt
        ]
      };
      return args;
    }
    case 'ERC1155:FC': {
      if (!properties.fcData) throw new Error('Missing FC data');
      const args = {
        contract: vaultFCActions,
        methodName: 'redeemCollateralAndModifyDebt',
        methodArgs: [
          properties.vault,
          properties.token,
          properties.tokenId,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          deltaNormalDebt
        ]
      };
      return args;
    }
    case 'ERC20:FY': {
      if (!properties.fyData) throw new Error('Missing FY data');
      // await contextData.fiat.dryrunViaProxy(
      const args = {
        contract: vaultFYActions,
        methodName: 'redeemCollateralAndModifyDebt',
        methodArgs: [
          properties.vault,
          properties.token,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          deltaNormalDebt
        ]
      };
      return args;
    }
    case 'ERC20:SPT': {
      if (!properties.sptData) throw new Error('Missing SPT data');
      // await contextData.fiat.dryrunViaProxy(
      const args = {
        contract: vaultSPTActions,
        methodName: 'redeemCollateralAndModifyDebt',
        methodArgs: [
          properties.vault,
          properties.token,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          tokenAmount,
          deltaNormalDebt,
          [
            properties.sptData.adapter,
            properties.sptData.maturity,
            properties.sptData.target,
            properties.underlierToken,
            tokenAmount
          ]
        ]
      };
      return args;
    }
    default: {
      throw new Error('Unsupported vault: ', properties.vaultType);
    }
  }
};
