import { decToWad, scaleToWad, WAD, wadToScale, ZERO } from '@fiatdao/sdk';
import { ethers } from 'ethers';

export const underlierToPToken = async (
  fiat: any,
  underlier: ethers.BigNumber,
  collateralType: any
) => {
  const { vault, tokenId, tokenScale, vaultType } = collateralType.properties;
  const { vaultEPTActions, vaultFCActions, vaultFYActions } =
    fiat.getContracts();

  if (!underlier.gt(ZERO)) {
    return ZERO;
  }

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

export const buyCollateralAndModifyDebt = async (
  contextData: any,
  // TODO avoid null checks on properties.<vaultName>Data with a typecheck here
  collateralTypeData: any,
  modifyPositionFormData: any
) => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions } =
    contextData.fiat.getContracts();
  const { properties } = collateralTypeData;

  const normalDebt = contextData.fiat
    .debtToNormalDebt(
      modifyPositionFormData.deltaDebt,
      collateralTypeData.state.codex.virtualRate
    )
    .mul(WAD.sub(decToWad(0.001)))
    .div(WAD);
  const tokenAmount = wadToScale(
    modifyPositionFormData.deltaCollateral,
    properties.tokenScale
  );

  switch (properties.vaultType) {
    case 'ERC20:EPT': {
      if (!properties.eptData) {
        console.error('Missing EPT data');
        return;
      }

      const deadline = Math.round(+new Date() / 1000) + 3600;

      console.log(
        await contextData.fiat.dryrunViaProxy(
          contextData.proxies[0],
          vaultEPTActions,
          'buyCollateralAndModifyDebt',
          properties.vault,
          contextData.proxies[0],
          contextData.user,
          contextData.user,
          modifyPositionFormData.underlier,
          normalDebt,
          [
            properties.eptData.balancerVault,
            properties.eptData.poolId,
            properties.underlierToken,
            properties.token,
            tokenAmount,
            deadline,
            modifyPositionFormData.underlier,
          ]
        )
      );
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
            modifyPositionFormData.underlier,
            properties.underlierScale
          )
            .mul(WAD)
            .div(modifyPositionFormData.deltaCollateral)
        ),
        properties.tokenScale
      );

      console.log(
        await contextData.fiat.dryrunViaProxy(
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
          modifyPositionFormData.underlier
        )
      );
      break;
    }

    case 'ERC20:FY': {
      if (!properties.fyData) {
        console.error('Missing FY data');
        return;
      }

      console.log(
        await contextData.fiat.dryrunViaProxy(
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
            modifyPositionFormData.underlier,
            properties.fyData.yieldSpacePool,
            properties.token,
            properties.underlierToken,
          ]
        )
      );
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
  modifyPositionFormData: any
) => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions } =
    contextData.fiat.getContracts();
  const { properties } = collateralTypeData;

  const normalDebt = contextData.fiat
    .debtToNormalDebt(
      modifyPositionFormData.deltaDebt,
      collateralTypeData.state.codex.virtualRate
    )
    .mul(WAD.sub(decToWad(0.001)))
    .div(WAD);
  const tokenAmount = wadToScale(
    modifyPositionFormData.deltaCollateral,
    properties.tokenScale
  );

  switch (properties.vaultType) {
    case 'ERC20:EPT': {
      if (!properties.eptData) {
        console.error('Missing EPT data');
        return;
      }

      const deadline = Math.round(+new Date() / 1000) + 3600;

      console.log(
        await contextData.fiat.dryrunViaProxy(
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
            modifyPositionFormData.underlier,
            deadline,
            tokenAmount,
          ]
        )
      );
      break;
    }

    case 'ERC1155:FC': {
      if (!properties.fcData) {
        console.error('Missing FC data');
        return;
      }

      const maxBorrowRate = wadToScale(
        WAD.sub(
          modifyPositionFormData.deltaCollateral
            .mul(WAD)
            .div(
              scaleToWad(
                modifyPositionFormData.underlier,
                properties.underlierScale
              )
            )
        ),
        properties.tokenScale
      );

      console.log(
        await contextData.fiat.dryrunViaProxy(
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
        )
      );
      break;
    }

    case 'ERC20:FY': {
      if (!properties.fyData) {
        console.error('Missing FY data');
        return;
      }

      console.log(
        await contextData.fiat.dryrunViaProxy(
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
            modifyPositionFormData.underlier,
            properties.fyData.yieldSpacePool,
            properties.token,
            properties.underlierToken,
          ]
        )
      );
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
  modifyPositionFormData: any
) => {
  const { vaultEPTActions, vaultFCActions, vaultFYActions } =
    contextData.fiat.getContracts();
  const { properties } = collateralTypeData;

  const normalDebt = contextData.fiat
    .debtToNormalDebt(
      modifyPositionFormData.deltaDebt,
      collateralTypeData.state.codex.virtualRate
    )
    .mul(WAD.sub(decToWad(0.001)))
    .div(WAD);
  const tokenAmount = wadToScale(
    modifyPositionFormData.deltaCollateral,
    properties.tokenScale
  );

  switch (properties.vaultType) {
    case 'ERC20:EPT': {
      if (!properties.eptData) {
        console.error('Missing EPT data');
        return;
      }

      console.log(
        await contextData.fiat.dryrunViaProxy(
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
        )
      );
      break;
    }

    case 'ERC1155:FC': {
      if (!properties.fcData) {
        console.error('Missing FC data');
        return;
      }

      console.log(
        await contextData.fiat.dryrunViaProxy(
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
        )
      );
      break;
    }

    case 'ERC20:FY': {
      if (!properties.fyData) {
        console.error('Missing FY data');
        return;
      }

      console.log(
        await contextData.fiat.dryrunViaProxy(
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
        )
      );
      break;
    }

    default: {
      console.error('Unsupported vault: ', properties.vaultType);
    }
  }
};

// TODO: maybe implement? or just delete it - underlier actions only is kinda nice
// export const modifyCollateralAndDebt = async (
//   contextData: any,
//   collateralTypeData: any,
//   modifyPositionFormData: any
// ) => {
//   const { vaultEPTActions, vaultFCActions, vaultFYActions } =
//     contextData.fiat.getContracts();
//   const { properties } = collateralTypeData;

//   const normalDebt = contextData.fiat
//     .debtToNormalDebt(
//       modifyPositionFormData.deltaDebt,
//       collateralTypeData.state.codex.virtualRate
//     )
//     .mul(WAD.sub(decToWad(0.001)))
//     .div(WAD);
//   const tokenAmount = wadToScale(
//     modifyPositionFormData.deltaCollateral,
//     properties.tokenScale
//   );

//   switch (properties.vaultType) {
//     case 'ERC20:EPT': {
//       if (!properties.eptData) {
//         console.error('Missing EPT data');
//         return;
//       }
//       break;
//     }

//     case 'ERC1155:FC': {
//       if (!properties.fcData) {
//         console.error('Missing FC data');
//         return;
//       }
//       break;
//     }

//     case 'ERC20:FY': {
//       if (!properties.fyData) {
//         console.error('Missing FY data');
//         return;
//       }
//       break;
//     }

//     default: {
//       console.error('Unsupported vault: ', properties.vaultType);
//     }
//   }
// };
