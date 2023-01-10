import { addressEq, debtToNormalDebt, decToWad, scaleToWad, WAD, wadToScale, ZERO } from '@fiatdao/sdk';
import { BigNumber, Contract } from 'ethers';

export const underlierToFIAT = async (
  fiat: any,
  underlierAmount: BigNumber,
  collateralType: any
): Promise<BigNumber> => {
  if (underlierAmount.isZero()) return ZERO;

  const { vaultType, underlierToken, underlierSymbol } = collateralType.properties;
  const { fiatToUnderlierTradePath: { pools, assetsOut } } = collateralType.metadata;
  const { leverEPTActions, leverFYActions, leverSPTActions } = fiat.getContracts();
  const poolsToFIAT = JSON.parse(JSON.stringify(pools)).reverse();
  const assetsIn = JSON.parse(JSON.stringify(assetsOut)).reverse();
  if (!addressEq(underlierToken, assetsIn[0])) throw new Error('Invalid trade path');

  try {
    switch (vaultType) {
      case 'ERC20:EPT': {
        return await fiat.call(
          leverEPTActions, 'underlierToFIAT', poolsToFIAT, assetsIn, underlierAmount
        );
      }
      case 'ERC20:FY': {
        return await fiat.call(
          leverFYActions, 'underlierToFIAT', poolsToFIAT, assetsIn, underlierAmount
        );
      }
      case 'ERC20:SPT': {
        return await fiat.call(
          leverSPTActions, 'underlierToFIAT', poolsToFIAT, assetsIn, underlierAmount
        );
      }
      default: {
        throw new Error('Unsupported collateral type');
      }
    }
  } catch (error) {
    console.error(error);
    throw new Error(`Insufficient liquidity to convert ${underlierSymbol} to FIAT`);
  }
};

// TODO: remove precision conversion
export const fiatToUnderlier = async (
  fiat: any,
  fiatAmount: BigNumber,
  collateralType: any
): Promise<BigNumber> => {
  if (fiatAmount.isZero()) return ZERO;

  const { vaultType, underlierToken, underlierSymbol } = collateralType.properties;
  const { fiatToUnderlierTradePath: { pools: poolsToUnderlier, assetsOut } } = collateralType.metadata;
  const { leverEPTActions, leverFYActions, leverSPTActions } = fiat.getContracts();
  if (!addressEq(underlierToken, assetsOut[assetsOut.length - 1])) throw new Error('Invalid trade path');

  try {
    switch (vaultType) {
      case 'ERC20:EPT': {
        return await fiat.call(
          leverEPTActions, 'fiatToUnderlier', poolsToUnderlier, assetsOut, fiatAmount
        );
      }
      case 'ERC20:FY': {
        return await fiat.call(
          leverFYActions, 'fiatToUnderlier', poolsToUnderlier, assetsOut, fiatAmount
        );
      }
      case 'ERC20:SPT': {
        return await fiat.call(
          leverSPTActions, 'fiatToUnderlier', poolsToUnderlier, assetsOut, fiatAmount
        );
      }
      default: {
        throw new Error('Unsupported collateral type');
      }
    }
  } catch (error) {
    console.error(error);
    throw new Error(`Insufficient liquidity to convert FIAT to ${underlierSymbol}`);
  }
};

export const fiatForUnderlier = async (
  fiat: any,
  fiatAmount: BigNumber,
  collateralType: any
): Promise<BigNumber> => {
  if (fiatAmount.isZero()) return ZERO;

  const { vaultType, underlierToken, underlierSymbol } = collateralType.properties;
  const { fiatToUnderlierTradePath: { pools, assetsOut } } = collateralType.metadata;
  const { leverEPTActions, leverFYActions, leverSPTActions } = fiat.getContracts();
  const poolsToFIAT = JSON.parse(JSON.stringify(pools)); // TODO: expected it to be reversed
  const assetsIn = JSON.parse(JSON.stringify(assetsOut)).reverse();
  if (!addressEq(underlierToken, assetsIn[0])) throw new Error('Invalid trade path');

  try {
    switch (vaultType) {
      case 'ERC20:EPT': {
        return await fiat.call(
          leverEPTActions, 'fiatForUnderlier', poolsToFIAT, assetsIn, fiatAmount
        );
      }
      case 'ERC20:FY': {
        return await fiat.call(
          leverFYActions, 'fiatForUnderlier', poolsToFIAT, assetsIn, fiatAmount
        );
      }
      case 'ERC20:SPT': {
        return await fiat.call(
          leverSPTActions, 'fiatForUnderlier', poolsToFIAT, assetsIn, fiatAmount
        );
      }
      default: {
        throw new Error('Unsupported collateral type');
      }
    }
  } catch (error) {
    console.error(error);
    throw new Error(`Insufficient liquidity to convert ${underlierSymbol} to FIAT`);
  }
};

export const underlierToCollateralToken = async (
  fiat: any,
  underlier: BigNumber,
  collateralType: any
): Promise<BigNumber> => {
  if (underlier.isZero()) return ZERO;

  const { vault, tokenId, vaultType, tokenSymbol, underlierSymbol } = collateralType.properties;
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = fiat.getContracts();

  try {
    switch (vaultType) {
      case 'ERC20:EPT': {
        if (collateralType.properties.eptData == undefined) throw new Error('Missing EPT data');
        const { eptData: { balancerVault: balancer, poolId: pool } } = collateralType.properties;
        return await fiat.call(
          vaultEPTActions, 'underlierToPToken', vault, balancer, pool, underlier
        );
      }
      case 'ERC1155:FC': {
        if (collateralType.properties.fcData == undefined) throw new Error('Missing FC data');
        return await fiat.call(
          vaultFCActions, 'underlierToFCash', tokenId, underlier
        );
      }
      case 'ERC20:FY': {
        if (collateralType.properties.fyData == undefined) throw new Error('Missing FY data');
        const { fyData: { yieldSpacePool } } = collateralType.properties;
        return await fiat.call(
          vaultFYActions, 'underlierToFYToken', underlier, yieldSpacePool
        );
      }
      case 'ERC20:SPT': {
        if (collateralType.properties.sptData == undefined) throw new Error('Missing SPT data');
        const { sptData: { spacePool, balancerVault } } = collateralType.properties;
        return await fiat.call(
          vaultSPTActions, 'underlierToPToken', spacePool, balancerVault, underlier
        );
      }
      default: {
        throw new Error('Unsupported collateral type');
      }
    }
  } catch (error) {
    console.error(error);
    throw new Error(`Insufficient liquidity to convert ${underlierSymbol} to ${tokenSymbol}`);
  }
};

export const collateralTokenToUnderlier = async (
  fiat: any,
  collateral: BigNumber,
  collateralType: any
): Promise<BigNumber> => {
  if (collateral.isZero()) return ZERO;
  const { vault, tokenId, vaultType, tokenSymbol, underlierSymbol } = collateralType.properties;
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = fiat.getContracts();

  try {
    switch (vaultType) {
      case 'ERC20:EPT': {
        if (collateralType.properties.eptData == undefined) throw new Error('Missing EPT data');
        const { eptData: { balancerVault: balancer, poolId: pool } } = collateralType.properties;
        return await fiat.call(
          vaultEPTActions, 'pTokenToUnderlier', vault, balancer, pool, collateral
        );
      }
      case 'ERC1155:FC': {
        if (collateralType.properties.fcData == undefined) throw new Error('Missing FC data');
        return await fiat.call(
          vaultFCActions, 'fCashToUnderlier', tokenId, collateral
        );
      }
      case 'ERC20:FY': {
        if (collateralType.properties.fyData == undefined) throw new Error('Missing FY data');
        const { fyData: { yieldSpacePool } } = collateralType.properties;
        return await fiat.call(
          vaultFYActions, 'fyTokenToUnderlier', collateral, yieldSpacePool
        );
      }
      case 'ERC20:SPT': {
        if (collateralType.properties.sptData == undefined) throw new Error('Missing SPT data');
        const { sptData: { spacePool, balancerVault } } = collateralType.properties;
        return await fiat.call(
          vaultSPTActions, 'pTokenToUnderlier', spacePool, balancerVault, collateral
        );
      }
      default:
        throw new Error('Unsupported collateral type');
    }
  } catch (error) {
    console.error(error);
    throw new Error(`Insufficient liquidity to convert ${tokenSymbol} to ${underlierSymbol}`);
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
  fiat: any,
  user: string,
  proxies: any[],
  collateralTypeData: any,
  deltaDebt: BigNumber,
  position: { collateral: BigNumber, normalDebt: BigNumber }
): { contract: Contract, methodName: string, methodArgs: any[] } => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = fiat.getContracts();
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
      proxies[0],
      user,
      user,
      ZERO,
      deltaNormalDebt,
    ],
  };
  return args;
}

export const buildBuyCollateralAndModifyDebtArgs = (
  fiat: any,
  user: string,
  proxies: any[],
  collateralTypeData: any,
  deltaCollateral: BigNumber,
  deltaDebt: BigNumber,
  underlier: BigNumber
): { contract: Contract, methodName: string, methodArgs: any[] } => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = fiat.getContracts();
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
          proxies[0],
          user,
          user,
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
          proxies[0],
          user,
          user,
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
        contract: vaultFYActions,
        methodName: 'buyCollateralAndModifyDebt',
        methodArgs: [
          properties.vault,
          proxies[0],
          user,
          user,
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
        contract: vaultSPTActions,
        methodName: 'buyCollateralAndModifyDebt',
        methodArgs: [
          properties.vault,
          proxies[0],
          user,
          user,
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
  fiat: any,
  user: string,
  proxies: any[],
  collateralTypeData: any,
  deltaCollateral: BigNumber,
  deltaDebt: BigNumber,
  underlier: BigNumber,
  position: any
): { contract: Contract, methodName: string, methodArgs: any[] } => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = fiat.getContracts();
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
          proxies[0],
          user,
          user,
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
          proxies[0],
          user,
          user,
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
          proxies[0],
          user,
          user,
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
          proxies[0],
          user,
          user,
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

export const buildRedeemCollateralAndModifyDebtArgs = (
  fiat: any,
  user: string,
  proxies: any[],
  collateralTypeData: any,
  deltaCollateral: BigNumber,
  deltaDebt: BigNumber,
  position: any
): { contract: Contract, methodName: string, methodArgs: any[] } => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions, vaultSPTActions } = fiat.getContracts();
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
          proxies[0],
          user,
          user,
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
          proxies[0],
          user,
          user,
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
          proxies[0],
          user,
          user,
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
          proxies[0],
          user,
          user,
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

export const buildBuyCollateralAndIncreaseLeverArgs = async (
  fiat: any,
  user: string,
  proxies: any[],
  collateralTypeData: any,
  upFrontUnderliers: BigNumber,
  addDebt: BigNumber,
  minUnderlierToBuy: BigNumber,
  minTokenToBuy: BigNumber,
): Promise<{ contract: Contract, methodName: string, methodArgs: any[] }> => {
  const { leverEPTActions, leverFYActions, leverSPTActions } = fiat.getContracts();
  const { properties } = collateralTypeData;
  const { fiatToUnderlierTradePath: { pools: poolsToUnderlier, assetsOut } } = collateralTypeData.metadata;
  const deadline = Math.round(+new Date() / 1000) + 3600;

  switch (properties.vaultType) {
    case 'ERC20:EPT': {
      if (!properties.eptData) throw new Error('Missing EPT data');
      const sellFIATSwapParams = await leverEPTActions.buildSellFIATSwapParams(
        poolsToUnderlier, assetsOut, minUnderlierToBuy, deadline
      );
      const args = {
        contract: leverEPTActions,
        methodName: 'buyCollateralAndIncreaseLever',
        methodArgs: [
          properties.vault,
          proxies[0],
          user,
          upFrontUnderliers,
          addDebt,
          sellFIATSwapParams,
          [
            properties.eptData.balancerVault,
            properties.eptData.poolId,
            properties.underlierToken,
            properties.token,
            minTokenToBuy,
            deadline
          ]
        ]
      };
      return args;
    }
    case 'ERC20:FY': {
      if (!properties.fyData) throw new Error('Missing FY data');
      const sellFIATSwapParams = await leverFYActions.buildSellFIATSwapParams(
        poolsToUnderlier, assetsOut, minUnderlierToBuy, deadline
      );
      const args = {
        contract: leverFYActions,
        methodName: 'buyCollateralAndIncreaseLever',
        methodArgs: [
          properties.vault,
          proxies[0],
          user,
          upFrontUnderliers,
          addDebt,
          sellFIATSwapParams,
          [
            minTokenToBuy,
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
      const sellFIATSwapParams = await leverSPTActions.buildSellFIATSwapParams(
        poolsToUnderlier, assetsOut, minUnderlierToBuy, deadline
      );
      const args = {
        contract: leverSPTActions,
        methodName: 'buyCollateralAndIncreaseLever',
        methodArgs: [
          properties.vault,
          proxies[0],
          user,
          upFrontUnderliers,
          addDebt,
          sellFIATSwapParams,
          [
            properties.sptData.adapter,
            minTokenToBuy,
            properties.sptData.maturity,
            properties.underlierToken,
            properties.token,
            upFrontUnderliers.add(minUnderlierToBuy)
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

export const buildSellCollateralAndDecreaseLeverArgs = async (
  fiat: any,
  user: string,
  proxies: any[],
  collateralTypeData: any,
  subTokenAmount: BigNumber,
  subDebt: BigNumber,
  maxUnderliersToSell: BigNumber,
  minUnderliersToBuy: BigNumber,
  position: any
): Promise<{ contract: Contract, methodName: string, methodArgs: any[] }> => {
  const { leverEPTActions, leverFYActions, leverSPTActions } = fiat.getContracts();
  const { properties } = collateralTypeData;
  const { fiatToUnderlierTradePath: { pools, assetsOut } } = collateralTypeData.metadata;
  const deadline = Math.round(+new Date() / 1000) + 3600;
  const poolsToFIAT = JSON.parse(JSON.stringify(pools)); // TODO: expected it to be reversed
  const assetsIn = JSON.parse(JSON.stringify(assetsOut)).reverse();

  let subNormalDebt = addDeltaNormalBuffer(debtToNormalDebt(subDebt, collateralTypeData.state.codex.virtualRate));
  if (position.normalDebt.sub(subNormalDebt).lt(WAD)) subNormalDebt = position.normalDebt;
  // if subTokenAmount is zero then debt can't be decreased
  if (subTokenAmount.isZero()) throw new Error('Invalid value for `subTokenAmount` - Value has to be non-zero');

  switch (properties.vaultType) {
    case 'ERC20:EPT': {
      if (!properties.eptData) throw new Error('Missing EPT data');
      const buyFIATSwapParams = await leverEPTActions.buildBuyFIATSwapParams(
        poolsToFIAT, assetsIn, maxUnderliersToSell, deadline
      );
      const args = {
        contract: leverEPTActions,
        methodName: 'sellCollateralAndDecreaseLever',
        methodArgs: [
          properties.vault,
          proxies[0],
          user,
          subTokenAmount,
          subNormalDebt,
          buyFIATSwapParams,
          [
            properties.eptData.balancerVault,
            properties.eptData.poolId,
            properties.token,
            properties.underlierToken,
            minUnderliersToBuy,
            deadline
          ]
        ]
      };
      return args;
    }
    case 'ERC20:FY': {
      if (!properties.fyData) throw new Error('Missing FY data');
      const buyFIATSwapParams = await leverFYActions.buildBuyFIATSwapParams(
        poolsToFIAT, assetsIn, maxUnderliersToSell, deadline
      );
      const args = {
        contract: leverFYActions,
        methodName: 'sellCollateralAndDecreaseLever',
        methodArgs: [
          properties.vault,
          proxies[0],
          user,
          subTokenAmount,
          subNormalDebt,
          buyFIATSwapParams,
          [
            minUnderliersToBuy,
            properties.fyData.yieldSpacePool,
            properties.token,
            properties.underlierToken
          ]
        ]
      };
      return args;
    }
    case 'ERC20:SPT': {
      if (!properties.sptData) throw new Error('Missing SPT data');
      const buyFIATSwapParams = await leverSPTActions.buildBuyFIATSwapParams(
        poolsToFIAT, assetsIn, maxUnderliersToSell, deadline
      );
      const args = {
        contract: leverSPTActions,
        methodName: 'sellCollateralAndDecreaseLever',
        methodArgs: [
          properties.vault,
          proxies[0],
          user,
          subTokenAmount,
          subNormalDebt,
          buyFIATSwapParams,
          [
            properties.sptData.adapter,
            minUnderliersToBuy,
            properties.sptData.maturity,
            properties.token,
            properties.underlierToken,
            subTokenAmount
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

export const buildRedeemCollateralAndDecreaseLeverArgs = async (
  fiat: any,
  user: string,
  proxies: any[],
  collateralTypeData: any,
  subTokenAmount: BigNumber,
  subDebt: BigNumber,
  maxUnderliersToSell: BigNumber,
  position: any
): Promise<{ contract: Contract, methodName: string, methodArgs: any[] }> => {
  const { leverEPTActions, leverFYActions, leverSPTActions } = fiat.getContracts();
  const { properties } = collateralTypeData;
  const { fiatToUnderlierTradePath: { pools, assetsOut } } = collateralTypeData.metadata;
  const deadline = Math.round(+new Date() / 1000) + 3600;
  const poolsToFIAT = JSON.parse(JSON.stringify(pools)); // TODO: expected it to be reversed
  const assetsIn = JSON.parse(JSON.stringify(assetsOut)).reverse();

  let subNormalDebt = addDeltaNormalBuffer(debtToNormalDebt(subDebt, collateralTypeData.state.codex.virtualRate));
  if (position.normalDebt.sub(subNormalDebt).lt(WAD)) subNormalDebt = position.normalDebt;
  // if subTokenAmount is zero then debt can't be decreased
  if (subTokenAmount.isZero()) throw new Error('Invalid value for `subTokenAmount` - Value has to be non-zero');

  switch (properties.vaultType) {
    case 'ERC20:EPT': {
      if (!properties.eptData) throw new Error('Missing EPT data');
      const buyFIATSwapParams = await leverEPTActions.buildBuyFIATSwapParams(
        poolsToFIAT, assetsIn, maxUnderliersToSell, deadline
      );
      const args = {
        contract: leverEPTActions,
        methodName: 'redeemCollateralAndDecreaseLever',
        methodArgs: [
          properties.vault,
          properties.token,
          proxies[0],
          user,
          subTokenAmount,
          subNormalDebt,
          buyFIATSwapParams
        ]
      };
      return args;
    }
    case 'ERC20:FY': {
      if (!properties.fyData) throw new Error('Missing FY data');
      const buyFIATSwapParams = await leverFYActions.buildBuyFIATSwapParams(
        poolsToFIAT, assetsIn, maxUnderliersToSell, deadline
      );
      const args = {
        contract: leverFYActions,
        methodName: 'redeemCollateralAndDecreaseLever',
        methodArgs: [
          properties.vault,
          properties.token,
          proxies[0],
          user,
          subTokenAmount,
          subNormalDebt,
          buyFIATSwapParams
        ]
      };
      return args;
    }
    case 'ERC20:SPT': {
      if (!properties.sptData) throw new Error('Missing SPT data');
      const buyFIATSwapParams = await leverSPTActions.buildBuyFIATSwapParams(
        poolsToFIAT, assetsIn, maxUnderliersToSell, deadline
      );
      const args = {
        contract: leverSPTActions,
        methodName: 'redeemCollateralAndDecreaseLever',
        methodArgs: [
          properties.vault,
          properties.token,
          proxies[0],
          user,
          subTokenAmount,
          subNormalDebt,
          buyFIATSwapParams
        ]
      };
      return args;
    }
    default: {
      throw new Error('Unsupported vault: ', properties.vaultType);
    }
  }
};
