import {
  computeCollateralizationRatio,
  computeMaxNormalDebt,
  debtToNormalDebt,
  decToScale,
  decToWad,
  normalDebtToDebt,
  scaleToWad,
  WAD,
  wadToDec,
  wadToScale,
  ZERO,
} from '@fiatdao/sdk';
import { BigNumber, BigNumberish } from 'ethers';
import create from 'zustand';
import * as userActions from '../actions';
import { debounce, floor2, minCollRatioWithBuffer } from '../utils';

/// A store for setting and getting form values to create and manage positions.
interface BorrowState {
  formDataLoading: boolean;
  formWarnings: string[];
  formErrors: string[];
  createState: {
    underlier: BigNumberish; // [underlierScale]
    slippagePct: BigNumberish; // [wad]
    targetedCollRatio: BigNumber; // [wad]
    collateral: BigNumber; // [wad]
    collRatio: BigNumber; // [wad] estimated new collateralization ratio
    debt: BigNumber; // [wad]
    deltaCollateral: BigNumber; // [wad]
    deltaDebt: BigNumber; // [wad]
    // TODO: give its own form errors and warning
  };
  increaseState: {
    underlier: BigNumberish; // [underlierScale]
    slippagePct: BigNumberish; // [wad]
    collateral: BigNumber; // [wad]
    collRatio: BigNumber; // [wad] estimated new collateralization ratio
    debt: BigNumber; // [wad]
    deltaCollateral: BigNumber; // [wad]
    deltaDebt: BigNumberish; // [wad]
  };
  decreaseState: {
    underlier: BigNumber; // [underlierScale]
    slippagePct: BigNumberish; // [wad]
    collateral: BigNumber; // [wad]
    collRatio: BigNumber; // [wad] estimated new collateralization ratio
    debt: BigNumber; // [wad]
    deltaCollateral: BigNumberish; // [wad]
    deltaDebt: BigNumberish; // [wad]
  };
  redeemState: {
    collateral: BigNumber; // [wad]
    collRatio: BigNumber; // [wad] estimated new collateralization ratio
    debt: BigNumber; // [wad]
    deltaCollateral: BigNumberish; // [wad]
    deltaDebt: BigNumberish; // [wad]
  };
}

interface BorrowActions {
  setFormDataLoading: (isLoading: boolean) => void;
  reset: () => void;
  createActions: {
    setUnderlier: (
      fiat: any,
      value: string,
      modifyPositionData: any,
    ) => void;
    setSlippagePct: (
      fiat: any,
      value: string,
      modifyPositionData: any,
    ) => void;
    setTargetedCollRatio: (
      fiat: any,
      value: number,
      modifyPositionData: any,
    ) => void;
    calculatePositionValuesAfterCreation: (
      fiat: any,
      modifyPositionData: any,
    ) => void;
  },
  increaseActions: {
    setUnderlier: (
      fiat: any,
      value: string,
      modifyPositionData: any,
      selectedCollateralTypeId?: string
    ) => void;
    setSlippagePct: (
      fiat: any,
      value: string,
      modifyPositionData: any,
      selectedCollateralTypeId?: string
    ) => void;
    setDeltaDebt: (
      fiat: any,
      value: string,
      modifyPositionData: any,
    ) => void;
    calculatePositionValuesAfterIncrease: (
      fiat: any,
      modifyPositionData: any,
    ) => void;
  },
  decreaseActions: {
    setDeltaCollateral: (
      fiat: any,
      value: string,
      modifyPositionData: any,
    ) => void;
    setSlippagePct: (
      fiat: any,
      value: string,
      modifyPositionData: any,
    ) => void;
    setDeltaDebt: (
      fiat: any,
      value: string,
      modifyPositionData: any,
    ) => void;
    calculatePositionValuesAfterDecrease: (
      fiat: any,
      modifyPositionData: any,
    ) => void;
  },
  redeemActions: {
    setDeltaCollateral: (
      fiat: any,
      value: string,
      modifyPositionData: any,
    ) => void;
    setDeltaDebt: (
      fiat: any,
      value: string,
      modifyPositionData: any,
    ) => void;
    calculatePositionValuesAfterRedeem: (
      fiat: any,
      modifyPositionData: any,
    ) => void;
  },
}

const initialState = {
  formDataLoading: false,
  formWarnings: [],
  formErrors: [],
  createState: {
    underlier: '',
    slippagePct: '0.01',
    targetedCollRatio: decToWad('1.2'),
    collateral: ZERO, // [wad]
    collRatio: ZERO, // [wad] estimated new collateralization ratio
    debt: ZERO, // [wad]
    deltaCollateral: ZERO,
    deltaDebt: ZERO, // [wad]
  },
  increaseState: {
    underlier: '',
    slippagePct: '0.01',
    targetedCollRatio: decToWad('1.2'),
    collateral: ZERO, // [wad]
    collRatio: ZERO, // [wad] estimated new collateralization ratio
    debt: ZERO, // [wad]
    deltaCollateral: ZERO,
    deltaDebt: '', // [wad]
  },
  decreaseState: {
    underlier: ZERO,
    slippagePct: '0.01',
    targetedCollRatio: decToWad('1.2'),
    collateral: ZERO, // [wad]
    collRatio: ZERO, // [wad] estimated new collateralization ratio
    debt: ZERO, // [wad]
    deltaCollateral: '',
    deltaDebt: '',
  },
  redeemState: {
    collateral: ZERO, // [wad]
    collRatio: ZERO, // [wad] estimated new collateralization ratio
    debt: ZERO, // [wad]
    deltaCollateral: '',
    deltaDebt: '', // [wad]
  },
};

export const useBorrowStore = create<BorrowState & BorrowActions>()((set, get) => ({
    ...initialState,

    setFormDataLoading: (isLoading) => { set(() => ({ formDataLoading: isLoading })) },

    reset: () => {
      set(initialState);
    },
    
    /*
        ____ ____  _____    _  _____ _____ 
       / ___|  _ \| ____|  / \|_   _| ____|
      | |   | |_) |  _|   / _ \ | | |  _|  
      | |___|  _ <| |___ / ___ \| | | |___ 
       \____|_| \_\_____/_/   \_\_| |_____|
                                           
          _    ____ _____ ___ ___  _   _ ____  
         / \  / ___|_   _|_ _/ _ \| \ | / ___| 
        / _ \| |     | |  | | | | |  \| \___ \ 
       / ___ \ |___  | |  | | |_| | |\  |___) |
      /_/   \_\____| |_| |___\___/|_| \_|____/ 
                                         
    */
    createActions: {
      setUnderlier: async (fiat, value, modifyPositionData) => {
        set((state) => ({
          createState: { ...state.createState, underlier: value },
          formDataLoading: true
        }));
        get().createActions.calculatePositionValuesAfterCreation(fiat, modifyPositionData);
      },

      setSlippagePct: (fiat, value, modifyPositionData) => {
        set((state) => ({
          createState: { ...state.createState, slippagePct: value },
          formDataLoading: true,
        }));
        get().createActions.calculatePositionValuesAfterCreation(fiat, modifyPositionData);
      },

      setTargetedCollRatio: (fiat, value, modifyPositionData) => {
        set((state) => ({
          createState: { ...state.createState, targetedCollRatio: decToWad(String(value)) },
          formDataLoading: true,
        }));
        get().createActions.calculatePositionValuesAfterCreation(fiat, modifyPositionData);
      },

      // Calculates new collateral, collRatio, debt, deltaCollateral, deltaDebt after position creation
      // Debounced to prevent spamming RPC calls
      calculatePositionValuesAfterCreation: debounce(async function (fiat: any, modifyPositionData: any) {
        const { collateralType } = modifyPositionData;
        const { tokenScale, underlierScale } = collateralType.properties;
        const { codex: { debtFloor }, collybus: { liquidationRatio } } = collateralType.settings;
        const { codex: { virtualRate: rate }, collybus: { fairPrice } } = collateralType.state;
        const { slippagePct, underlier } = get().createState;

        // Convert user inputs from strings to BigNumbers
        const underlierBN = underlier === null || underlier === ''
          ? ZERO
          : decToScale(underlier, underlierScale);

        const ceiled = Number(slippagePct) < 0 ? 0 : Number(slippagePct) > 50 ? 50 : Number(slippagePct);
        const slippageBN = decToWad(ceiled / 100);

        // Reset form errors and warnings on new input
        set(() => ({ formWarnings: [], formErrors: [] }));

        try {
          let deltaCollateral = ZERO;
          if (!underlierBN.isZero()) {
            try {
              // Preview underlierBN to collateral token swap
              const tokensOut = await userActions.underlierToCollateralToken(fiat, underlierBN, collateralType);
              // redemption price with a 1:1 exchange rate
              const minTokensOut = underlierBN.mul(tokenScale).div(underlierScale);
              // apply slippagePct to preview
              const tokensOutWithSlippage = tokensOut.mul(WAD.sub(slippageBN)).div(WAD);
              // assert: minTokensOut > idealTokenOut
              if (tokensOutWithSlippage.lt(minTokensOut)) set(() => (
                { formWarnings: ['Large Price Impact (Negative Yield)'] }
              ));
              deltaCollateral = scaleToWad(tokensOut, tokenScale).mul(WAD.sub(slippageBN)).div(WAD);
            } catch (e: any) {
              if (e.reason && e.reason === 'BAL#001') {
                // Catch balancer-specific underflow error
                // https://dev.balancer.fi/references/error-codes
                throw new Error('Insufficient liquidity to convert underlier to collateral');
              }
              throw e;
            }
          }

          // For new position, calculate deltaDebt based on targetedCollRatio
          const { targetedCollRatio } = get().createState;
          const deltaNormalDebt = computeMaxNormalDebt(deltaCollateral, rate, fairPrice, targetedCollRatio);
          const deltaDebt = normalDebtToDebt(deltaNormalDebt, rate);
          const collateral = deltaCollateral;
          const debt = deltaDebt;
          const collRatio = computeCollateralizationRatio(collateral, fairPrice, deltaNormalDebt, rate);
          const minCollRatio = minCollRatioWithBuffer(liquidationRatio);

          if (deltaDebt.gt(ZERO) && deltaDebt.lte(debtFloor)) set(() => ({
            formErrors: [
              ...get().formErrors,
              `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
            ]
          }));
          if (debt.gt(0) && collRatio.lt(minCollRatio)) set(() => ({
            formErrors: [
              ...get().formErrors, 'Collateralization Ratio has to be greater than ' + floor2(wadToDec(minCollRatio))
            ]
          }));

          const newCreateFormState = { collateral, collRatio, debt, deltaCollateral, deltaDebt };
          set((state) => ({
            createState: { ...state.createState, ...newCreateFormState },
            formDataLoading: false,
          }));
        } catch (error: any) {
          set((state) => ({
            createState: {
              ...state.createState,
              deltaCollateral: ZERO,
              deltaDebt: ZERO,
              collateral: ZERO,
              debt: ZERO,
              collRatio: ZERO,
            },
            formErrors: [...get().formErrors, error.message],
          }));
        }
      }),
    },

    /*
       ___ _   _  ____ ____  _____    _    ____  _____ 
      |_ _| \ | |/ ___|  _ \| ____|  / \  / ___|| ____|
       | ||  \| | |   | |_) |  _|   / _ \ \___ \|  _|  
       | || |\  | |___|  _ <| |___ / ___ \ ___) | |___ 
      |___|_| \_|\____|_| \_\_____/_/   \_\____/|_____|
                                                       
          _    ____ _____ ___ ___  _   _ ____  
         / \  / ___|_   _|_ _/ _ \| \ | / ___| 
        / _ \| |     | |  | | | | |  \| \___ \ 
       / ___ \ |___  | |  | | |_| | |\  |___) |
      /_/   \_\____| |_| |___\___/|_| \_|____/ 
                                         
    */

    increaseActions: {
      setUnderlier: async (fiat, value, modifyPositionData) => {
        set((state) => ({
          increaseState: { ...state.increaseState, underlier: value },
          formDataLoading: true,
        }));
        get().increaseActions.calculatePositionValuesAfterIncrease(fiat, modifyPositionData);
      },

      setSlippagePct: (fiat, value, modifyPositionData) => {
        set((state) => ({
          increaseState: { ...state.increaseState, slippagePct: value },
          formDataLoading: true,
        }));
        get().increaseActions.calculatePositionValuesAfterIncrease(fiat, modifyPositionData);
      },

      setDeltaDebt: (fiat, value, modifyPositionData) => {
        set((state) => ({
          increaseState: {
            ...state.increaseState,
            deltaDebt: value,
          },
          formDataLoading: true
        }));
        get().increaseActions.calculatePositionValuesAfterIncrease(fiat, modifyPositionData);
      },

      calculatePositionValuesAfterIncrease: debounce(async (fiat: any, modifyPositionData: any) => {
        const { collateralType, position } = modifyPositionData;
        const { tokenScale, underlierScale } = collateralType.properties;
        const { codex: { debtFloor }, collybus: { liquidationRatio } } = collateralType.settings;
        const { codex: { virtualRate: rate }, collybus: { fairPrice } } = collateralType.state;
        const { deltaDebt, slippagePct, underlier } = get().increaseState;

        // Convert user inputs from strings to BigNumbers
        const underlierBN = underlier === null || underlier === ''
          ? ZERO
          : decToScale(underlier, underlierScale);

        const ceiled = Number(slippagePct) < 0 ? 0 : Number(slippagePct) > 50 ? 50 : Number(slippagePct);
        const slippageBN = decToWad(ceiled / 100);

        const deltaDebtBN = deltaDebt === null || deltaDebt === ''
          ? ZERO
          : decToWad(deltaDebt);

        // Reset form errors and warnings on new input
        set(() => ({ formWarnings: [], formErrors: [] }));

        try {
          let deltaCollateral = ZERO;
          if (!underlierBN.isZero()) {
            try {
              // Preview underlier to collateral token swap
              const tokensOut = await userActions.underlierToCollateralToken(fiat, underlierBN, collateralType);
              // redemption price with a 1:1 exchange rate
              const minTokensOut = underlierBN.mul(tokenScale).div(underlierScale);
              // apply slippagePct to preview
              const tokensOutWithSlippage = tokensOut.mul(WAD.sub(slippageBN)).div(WAD);
              // assert: minTokensOut > idealTokenOut
              if (tokensOutWithSlippage.lt(minTokensOut)) set(() => (
                { formWarnings: ['Large Price Impact (Negative Yield)'] }
              ));
              deltaCollateral = scaleToWad(tokensOut, tokenScale).mul(WAD.sub(slippageBN)).div(WAD);
            } catch (e: any) {
              if (e.reason && e.reason === 'BAL#001') {
                // Catch balancer-specific underflow error
                // https://dev.balancer.fi/references/error-codes
                throw new Error('Insufficient liquidity to convert underlier to collateral');
              }
              throw e;
            }
          }

          // Estimate new position values based on deltaDebt, taking into account an existing position's collateral
          const collateral = position.collateral.add(deltaCollateral);
          const debt = normalDebtToDebt(position.normalDebt, rate).add(deltaDebtBN);
          const normalDebt = debtToNormalDebt(debt, rate);
          const collRatio = computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate);
          const minCollRatio = liquidationRatio.add(decToWad(0.025));

          if (debt.gt(ZERO) && debt.lte(collateralType.settings.codex.debtFloor) ) set(() => ({
            formErrors: [
              ...get().formErrors,
              `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
            ]
          }));

          if (debt.gt(0) && collRatio.lte(minCollRatio)) set(() => ({
            formErrors: [
              ...get().formErrors, 'Collateralization Ratio has to be greater than ' + floor2(wadToDec(minCollRatio))
            ]
          }));

          set((state) => ({
            increaseState: { ...state.increaseState, collateral, collRatio, debt, deltaCollateral },
            formDataLoading: false,
          }));
        } catch (e: any) {
          set((state) => ({
            increaseState: {
              ...state.increaseState,
              collateral: ZERO,
              collRatio: ZERO,
              debt: ZERO,
              deltaCollateral: ZERO,
            },
            formDataLoading: false,
            formErrors: [...get().formErrors, e.message],
          }));
        }
      }),
    },

    /*
       ____  _____ ____ ____  _____    _    ____  _____ 
      |  _ \| ____/ ___|  _ \| ____|  / \  / ___|| ____|
      | | | |  _|| |   | |_) |  _|   / _ \ \___ \|  _|  
      | |_| | |__| |___|  _ <| |___ / ___ \ ___) | |___ 
      |____/|_____\____|_| \_\_____/_/   \_\____/|_____|
                                                        
          _    ____ _____ ___ ___  _   _ ____  
         / \  / ___|_   _|_ _/ _ \| \ | / ___| 
        / _ \| |     | |  | | | | |  \| \___ \ 
       / ___ \ |___  | |  | | |_| | |\  |___) |
      /_/   \_\____| |_| |___\___/|_| \_|____/ 
                                         
    */

    decreaseActions: {
      setDeltaCollateral: (fiat, value, modifyPositionData) => {
        set((state) => ({
          decreaseState: { ...state.decreaseState, deltaCollateral: value },
          formDataLoading: true,
        }));
        get().decreaseActions.calculatePositionValuesAfterDecrease(fiat, modifyPositionData);
      },

      setSlippagePct: (fiat, value, modifyPositionData) => {
        set((state) => ({
          decreaseState: { ...state.decreaseState, slippagePct: value },
          formDataLoading: true,
        }));
        get().decreaseActions.calculatePositionValuesAfterDecrease(fiat, modifyPositionData);
      },

      setDeltaDebt: (fiat, value, modifyPositionData) => {
        set((state) => ({
          decreaseState: { ...state.decreaseState, deltaDebt: value },
          formDataLoading: true,
        }));
        get().decreaseActions.calculatePositionValuesAfterDecrease(fiat, modifyPositionData);
      },

      calculatePositionValuesAfterDecrease: debounce(async (fiat: any, modifyPositionData: any) => {
        const { collateralType, position } = modifyPositionData;
        const { tokenScale } = collateralType.properties;
        const { codex: { debtFloor }, collybus: { liquidationRatio } } = collateralType.settings;
        const { codex: { virtualRate: rate }, collybus: { fairPrice } } = collateralType.state;
        const { deltaCollateral, deltaDebt, slippagePct } = get().decreaseState;

        // Convert user inputs from strings to BigNumbers
        const deltaCollateralBN = deltaCollateral === null || deltaCollateral === ''
          ? ZERO
          : decToWad(deltaCollateral);

        const ceiled = Number(slippagePct) < 0 ? 0 : Number(slippagePct) > 50 ? 50 : Number(slippagePct);
        const slippageBN = decToWad(ceiled / 100);

        const deltaDebtBN = deltaDebt === null || deltaDebt === ''
          ? ZERO
          : decToWad(deltaDebt);

        // Reset form errors and warnings on new input
        set(() => ({ formWarnings: [], formErrors: [] }));

        try {
          const tokenInScaled = wadToScale(deltaCollateralBN, tokenScale);
          let underlier = ZERO;
          if (!tokenInScaled.isZero()) {
            try {
              const underlierAmount = await userActions.collateralTokenToUnderlier(fiat, tokenInScaled, collateralType);
              underlier = underlierAmount.mul(WAD.sub(slippageBN)).div(WAD); // with slippage
            } catch (e: any) {
              if (e.reason && e.reason === 'BAL#001') {
                // Catch balancer-specific underflow error
                // https://dev.balancer.fi/references/error-codes
                throw new Error('Insufficient liquidity to convert collateral to underlier');
              }
              throw e;
            }
          }
          const deltaNormalDebt = debtToNormalDebt(deltaDebtBN, rate);

          if (position.collateral.lt(deltaCollateralBN)) set(() => ({
            formErrors: [...get().formErrors, 'Insufficient collateral']
          }));
          if (position.normalDebt.lt(deltaNormalDebt)) set(() => ({
            formErrors: [...get().formErrors, 'Insufficient debt']
          }));

          const collateral = position.collateral.sub(deltaCollateralBN);
          let normalDebt = position.normalDebt.sub(deltaNormalDebt);
          // override normalDebt to position.normalDebt if normalDebt is less than 1 FIAT 
          if (normalDebt.lt(WAD)) normalDebt = ZERO;
          const debt = normalDebtToDebt(normalDebt, rate);
          if (debt.gt(ZERO) && debt.lt(debtFloor)) set(() => ({
            formErrors: [
              ...get().formErrors,
              `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
            ]
          }));

          const collRatio = computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate);
          const minCollRatio = minCollRatioWithBuffer(liquidationRatio);
          if (!(collateral.isZero() && normalDebt.isZero()) && collRatio.lte(minCollRatio)) set(() => ({
            formErrors: [
              ...get().formErrors, 'Collateralization Ratio has to be greater than ' + floor2(wadToDec(minCollRatio))
            ]
          }));

          set((state) => ({
            decreaseState: {
              ...state.decreaseState,
              collRatio,
              underlier,
              collateral,
              debt
            },
            formDataLoading: false,
          }));
        } catch(e: any) {
          set((state) => ({
            decreaseState: {
              ...state.decreaseState,
              underlier: ZERO,
              collateral: position.collateral,
              debt: normalDebtToDebt(position.normalDebt, rate),
              collRatio: computeCollateralizationRatio(position.collateral, fairPrice, position.normalDebt, rate),
              formErrors: [...get().formErrors, e.message],
            },
            formDataLoading: false,
            formErrors: [...get().formErrors, e.message],
          }));
        }
      }),
    },

    /*
       ____  _____ ____  _____ _____ __  __ 
      |  _ \| ____|  _ \| ____| ____|  \/  |
      | |_) |  _| | | | |  _| |  _| | |\/| |
      |  _ <| |___| |_| | |___| |___| |  | |
      |_| \_\_____|____/|_____|_____|_|  |_|
                                            
          _    ____ _____ ___ ___  _   _ ____  
         / \  / ___|_   _|_ _/ _ \| \ | / ___| 
        / _ \| |     | |  | | | | |  \| \___ \ 
       / ___ \ |___  | |  | | |_| | |\  |___) |
      /_/   \_\____| |_| |___\___/|_| \_|____/ 
                                         
    */
    redeemActions: {
      setDeltaCollateral: (fiat, value, modifyPositionData) => {
        // Re-estimate new collateralization ratio and debt
        set((state) => ({
          redeemState: { ...state.redeemState, deltaCollateral: value },
          formDataLoading: true,
        }));
        get().redeemActions.calculatePositionValuesAfterRedeem(fiat, modifyPositionData);
      },

      setDeltaDebt: (fiat, value, modifyPositionData) => {
        set((state) => ({
          redeemState: { ...state.redeemState, deltaDebt: value },
          formDataLoading: true,
        }));
        get().redeemActions.calculatePositionValuesAfterRedeem(fiat, modifyPositionData);
      },

      calculatePositionValuesAfterRedeem: debounce(async (fiat: any, modifyPositionData: any) => {
        const { collateralType, position } = modifyPositionData;
        const { codex: { debtFloor }, collybus: { liquidationRatio } } = collateralType.settings;
        const { codex: { virtualRate: rate }, collybus: { fairPrice } } = collateralType.state;
        const { deltaCollateral, deltaDebt } = get().redeemState;

        // Convert user inputs from strings to BigNumbers
        const deltaCollateralBN = deltaCollateral === null || deltaCollateral === ''
          ? ZERO
          : decToWad(deltaCollateral);

        const deltaDebtBN = deltaDebt === null || deltaDebt === ''
          ? ZERO
          : decToWad(deltaDebt);

        // Reset form errors and warnings on new input
        set(() => ({ formWarnings: [], formErrors: [] }));

        try {
          const deltaNormalDebt = debtToNormalDebt(deltaDebtBN, rate);

          if (position.collateral.lt(deltaCollateralBN)) set(() => ({
            formErrors: [...get().formErrors, 'Insufficient collateral']
          }));
          if (position.normalDebt.lt(deltaNormalDebt)) set(() => ({
            formErrors: [...get().formErrors, 'Insufficient debt']
          }));

          const collateral = position.collateral.sub(deltaCollateralBN);
          let normalDebt = position.normalDebt.sub(deltaNormalDebt);
          // override normalDebt to position.normalDebt if normalDebt is less than 1 FIAT 
          if (normalDebt.lt(WAD)) normalDebt = ZERO;
          const debt = normalDebtToDebt(normalDebt, rate);
          if (debt.gt(ZERO) && debt.lt(debtFloor)) set(() => ({
            formErrors: [
              ...get().formErrors,
              `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
            ]
          }));
          const collRatio = computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate);
          const minCollRatio = minCollRatioWithBuffer(liquidationRatio);
          if (!(collateral.isZero() && normalDebt.isZero()) && collRatio.lte(minCollRatio)) set(() => ({
            formErrors: [
              ...get().formErrors, 'Collateralization Ratio has to be greater than ' + floor2(wadToDec(minCollRatio))
            ]
          }));

          set((state) => ({
            redeemState: {
              ...state.redeemState,
              collRatio,
              collateral,
              debt,
            },
            formDataLoading: false,
          }));
        } catch (e: any) {
          set((state) => ({
            redeemState: {
              ...state.redeemState,
              underlier: ZERO,
              collateral: position.collateral,
              debt: normalDebtToDebt(position.normalDebt, rate),
              collRatio: computeCollateralizationRatio(position.collateral, fairPrice, position.normalDebt, rate),
            },
            formDataLoading: false,
            formErrors: [...get().formErrors, e.message],
          }));
        }
      }),
    },
  }));
