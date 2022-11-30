import create from 'zustand';
import { BigNumber } from 'ethers';
import { decToScale, decToWad, scaleToWad, WAD, wadToDec, wadToScale, ZERO } from '@fiatdao/sdk';

import * as userActions from '../actions';
import { debounce, floor4 } from '../utils';

export const enum Mode {
  CREATE='create',
  INCREASE='increase',
  DECREASE='decrease',
  REDEEM='redeem',
}

/// A store for setting and getting form values to create and manage positions.
interface ModifyPositionState {
  mode: Mode; // [deposit, withdraw, redeem]
  createState: {
    underlier: BigNumber; // [underlierScale]
    slippagePct: BigNumber; // [wad]
    targetedCollRatio: BigNumber; // [wad]
    collateral: BigNumber; // [wad]
    collRatio: BigNumber; // [wad] estimated new collateralization ratio
    debt: BigNumber; // [wad]
    deltaCollateral: BigNumber; // [wad]
    deltaDebt: BigNumber; // [wad]
    // TODO: give its own form errors and warning
  };
  increaseState: {
    underlier: BigNumber; // [underlierScale]
    slippagePct: BigNumber; // [wad]
    collateral: BigNumber; // [wad]
    collRatio: BigNumber; // [wad] estimated new collateralization ratio
    debt: BigNumber; // [wad]
    deltaCollateral: BigNumber; // [wad]
    deltaDebt: BigNumber; // [wad]
  };
  decreaseState: {
    underlier: BigNumber; // [underlierScale]
    slippagePct: BigNumber; // [wad]
    collateral: BigNumber; // [wad]
    collRatio: BigNumber; // [wad] estimated new collateralization ratio
    debt: BigNumber; // [wad]
    deltaCollateral: BigNumber; // [wad]
    deltaDebt: BigNumber; // [wad]
  };
  slippagePct: BigNumber; // [wad]
  underlier: BigNumber; // [underlierScale]
  deltaCollateral: BigNumber; // [wad]
  deltaDebt: BigNumber; // [wad]
  collateral: BigNumber; // [wad]
  debt: BigNumber; // [wad]
  collRatio: BigNumber; // [wad] estimated new collateralization ratio
  targetedCollRatio: BigNumber; // [wad]
  formDataLoading: boolean;
  formWarnings: string[];
  formErrors: string[];
}

interface ModifyPositionActions {
  setMode: (mode: Mode) => void;
  createActions: {
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
    setTargetedCollRatio: (
      fiat: any,
      value: number,
      modifyPositionData: any,
      selectedCollateralTypeId: string
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
    setMaxDeltaCollateral: (
      fiat: any,
      modifyPositionData: any,
    ) => void;
    setMaxDeltaDebt: (
      fiat: any,
      modifyPositionData: any,
    ) => void;
    calculatePositionValuesAfterDecrease: (
      fiat: any,
      modifyPositionData: any,
    ) => void;
  },
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
  setTargetedCollRatio: (
    fiat: any,
    value: number,
    modifyPositionData: any,
    selectedCollateralTypeId: string
  ) => void;
  setMaxUnderlier: (
    fiat: any,
    modifyPositionData: any,
  ) => void;
  setDeltaCollateral: (
    fiat: any,
    value: string,
    modifyPositionData: any,
  ) => void;
  setMaxDeltaCollateral: (
    fiat: any,
    modifyPositionData: any,
  ) => void;
  setDeltaDebt: (
    fiat: any,
    value: string,
    modifyPositionData: any,
  ) => void;
  setMaxDeltaDebt: (
    fiat: any,
    modifyPositionData: any,
  ) => void;
  setFormDataLoading: (isLoading: boolean) => void;
  calculatePositionValuesAfterAction: (
    fiat: any,
    modifyPositionData: any,
    selectedCollateralTypeId?: string
  ) => void;
  // calculatePositionValuesAfterIncrease: (
  //   fiat: any,
  //   modifyPositionData: any,
  // ) => Promise<void>;
  // calculatePositionValuesAfterDecrease: (
  //   fiat: any,
  //   modifyPositionData: any,
  // ) => Promise<void>;
  calculatePositionValuesAfterRedeem: (
    fiat: any,
    modifyPositionData: any,
  ) => Promise<void>;
  resetCollateralAndDebtInputs: (fiat: any, modifyPositionData: any) => void;
  reset: () => void;
}

const initialState = {
  mode: Mode.INCREASE,
  createState: {
    underlier: ZERO,
    slippagePct: decToWad('0.001'),
    targetedCollRatio: decToWad('1.2'),
    collateral: ZERO, // [wad]
    collRatio: ZERO, // [wad] estimated new collateralization ratio
    debt: ZERO, // [wad]
    deltaCollateral: ZERO,
    deltaDebt: ZERO, // [wad]
  },
  increaseState: {
    underlier: ZERO,
    slippagePct: decToWad('0.001'),
    targetedCollRatio: decToWad('1.2'),
    collateral: ZERO, // [wad]
    collRatio: ZERO, // [wad] estimated new collateralization ratio
    debt: ZERO, // [wad]
    deltaCollateral: ZERO,
    deltaDebt: ZERO, // [wad]
  },
  decreaseState: {
    underlier: ZERO,
    slippagePct: decToWad('0.001'),
    targetedCollRatio: decToWad('1.2'),
    collateral: ZERO, // [wad]
    collRatio: ZERO, // [wad] estimated new collateralization ratio
    debt: ZERO, // [wad]
    deltaCollateral: ZERO,
    deltaDebt: ZERO, // [wad]
  },
  slippagePct: decToWad('0.001'),
  underlier: ZERO,
  deltaCollateral: ZERO,
  deltaDebt: ZERO, // [wad]
  collateral: ZERO, // [wad]
  debt: ZERO, // [wad]
  collRatio: ZERO, // [wad] estimated new collateralization ratio
  targetedCollRatio: decToWad('1.2'),
  formDataLoading: false,
  formWarnings: [],
  formErrors: [],
};

export const useModifyPositionStore = create<ModifyPositionState & ModifyPositionActions>()((set, get) => ({
    ...initialState,

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
        const collateralType = modifyPositionData.collateralType;
        const underlierScale = collateralType.properties.underlierScale;
        const underlier = value === null || value === ''
          ? initialState.createState.underlier
          : decToScale(floor4(Number(value) < 0 ? 0 : Number(value)), underlierScale);

          set((state) => ({
            createState: { ...state.createState, underlier },
            formDataLoading: true
          }));
          get().createActions.calculatePositionValuesAfterCreation(fiat, modifyPositionData);
      },

      setSlippagePct: (fiat, value, modifyPositionData) => {
        let newSlippage: BigNumber;
        if (value === null || value === '') {
          newSlippage = initialState.createState.slippagePct;
        } else {
          const ceiled = Number(value) < 0 ? 0 : Number(value) > 50 ? 50 : Number(value);
          newSlippage = decToWad(floor4(ceiled / 100));
        }

        set((state) => ({
          createState: { ...state.createState, slippagePct: newSlippage },
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
        const { codex: { debtFloor } } = collateralType.settings;
        const { slippagePct, underlier } = get().createState;
        const { codex: { virtualRate: rate }, collybus: { fairPrice } } = collateralType.state;

        // Reset form errors and warnings on new input
        set(() => ({ formWarnings: [], formErrors: [] }));

        try {
          let deltaCollateral = ZERO;
          if (!underlier.isZero()) {
            try {
              // Preview underlier to collateral token swap
              const tokensOut = await userActions.underlierToCollateralToken(fiat, underlier, collateralType);
              // redemption price with a 1:1 exchange rate
              const minTokensOut = underlier.mul(tokenScale).div(underlierScale);
              // apply slippagePct to preview
              const tokensOutWithSlippage = tokensOut.mul(WAD.sub(slippagePct)).div(WAD);
              // assert: minTokensOut > idealTokenOut
              if (tokensOutWithSlippage.lt(minTokensOut)) set(() => (
                { formWarnings: ['Large Price Impact (Negative Yield)'] }
              ));
              deltaCollateral = scaleToWad(tokensOut, tokenScale).mul(WAD.sub(slippagePct)).div(WAD);
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
          const deltaNormalDebt = fiat.computeMaxNormalDebt(deltaCollateral, rate, fairPrice, targetedCollRatio);
          const deltaDebt = fiat.normalDebtToDebt(deltaNormalDebt, rate);
          const collateral = deltaCollateral;
          const debt = deltaDebt;
          const collRatio = fiat.computeCollateralizationRatio(collateral, fairPrice, deltaNormalDebt, rate);

          if (deltaDebt.gt(ZERO) && deltaDebt.lte(debtFloor)) set(() => ({
            formErrors: [
              ...get().formErrors,
              `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
            ]
          }));
          if (debt.gt(0) && collRatio.lte(WAD)) set(() => ({
            formErrors: [...get().formErrors, 'Collateralization Ratio has to be greater than 100%']
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
        const collateralType = modifyPositionData.collateralType;
        const underlierScale = collateralType.properties.underlierScale;
        const underlier = value === null || value === ''
          ? initialState.increaseState.underlier
          : decToScale(floor4(Number(value) < 0 ? 0 : Number(value)), underlierScale);

        set((state) => ({
          increaseState: { ...state.increaseState, underlier },
          formDataLoading: true,
        }));
        get().increaseActions.calculatePositionValuesAfterIncrease(fiat, modifyPositionData);
      },

      setSlippagePct: (
        fiat,
        value,
        modifyPositionData,
      ) => {
        let newSlippage: BigNumber;
        if (value === null || value === '') {
          newSlippage = initialState.increaseState.slippagePct;
        } else {
          const ceiled = Number(value) < 0 ? 0 : Number(value) > 50 ? 50 : Number(value);
          newSlippage = decToWad(floor4(ceiled / 100));
        }

        set((state) => ({
          increaseState: { ...state.increaseState, slippagePct: newSlippage },
          formDataLoading: true,
        }));
        get().increaseActions.calculatePositionValuesAfterIncrease(fiat, modifyPositionData);
      },

      setDeltaDebt: (
        fiat,
        value,
        modifyPositionData,
      ) => {
        let newDeltaDebt: BigNumber;
        if (value === null || value === '') newDeltaDebt = initialState.increaseState.deltaDebt;
        else newDeltaDebt = decToWad(floor4(Number(value) < 0 ? 0 : Number(value)));

        set((state) => ({
          increaseState: {
            ...state.increaseState,
            deltaDebt: newDeltaDebt,
          },
          formDataLoading: true
        }));
        get().increaseActions.calculatePositionValuesAfterIncrease(fiat, modifyPositionData);
      },

      calculatePositionValuesAfterIncrease: debounce(async (fiat: any, modifyPositionData: any) => {
        const { collateralType, position } = modifyPositionData;
        const { tokenScale, underlierScale } = collateralType.properties;
        const { codex: { debtFloor } } = collateralType.settings;
        const { slippagePct, underlier } = get().increaseState;
        const { codex: { virtualRate: rate }, collybus: { fairPrice } } = collateralType.state;

        try {
          let deltaCollateral = ZERO;
          if (!underlier.isZero()) {
            try {
              // Preview underlier to collateral token swap
              const tokensOut = await userActions.underlierToCollateralToken(fiat, underlier, collateralType);
              // redemption price with a 1:1 exchange rate
              const minTokensOut = underlier.mul(tokenScale).div(underlierScale);
              // apply slippagePct to preview
              const tokensOutWithSlippage = tokensOut.mul(WAD.sub(slippagePct)).div(WAD);
              // assert: minTokensOut > idealTokenOut
              if (tokensOutWithSlippage.lt(minTokensOut)) set(() => (
                { formWarnings: ['Large Price Impact (Negative Yield)'] }
              ));
              deltaCollateral = scaleToWad(tokensOut, tokenScale).mul(WAD.sub(slippagePct)).div(WAD);
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
          const { deltaDebt } = get().increaseState;
          const collateral = position.collateral.add(deltaCollateral);
          const debt = fiat.normalDebtToDebt(position.normalDebt, rate).add(deltaDebt);
          const normalDebt = fiat.debtToNormalDebt(debt, rate);
          const collRatio = fiat.computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate);

          if (debt.gt(ZERO) && debt.lte(collateralType.settings.codex.debtFloor) ) set(() => ({
            formErrors: [
              ...get().formErrors,
              `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
            ]
          }));

          if (debt.gt(0) && collRatio.lte(WAD)) set(() => ({
            formErrors: [...get().formErrors, 'Collateralization Ratio has to be greater than 100%']
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
              deltaDebt: ZERO,
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
        console.log('val: ', value);
        let newDeltaCollateral: BigNumber;
        if (value === null || value === '') newDeltaCollateral = initialState.decreaseState.deltaCollateral;
        else newDeltaCollateral = decToWad(floor4(Number(value) < 0 ? 0 : Number(value)));

        // Re-estimate new collateralization ratio and debt
        set((state) => ({
          decreaseState: {
            ...state.decreaseState,
            deltaCollateral: newDeltaCollateral,
          },
          formDataLoading: true,
        }));
        get().decreaseActions.calculatePositionValuesAfterDecrease(fiat, modifyPositionData);
      },

      setMaxDeltaCollateral: (fiat, modifyPositionData) => {
        const deltaCollateral = modifyPositionData.position.collateral;

        // Re-estimate new collateralization ratio and debt
        set((state) => ({
          decreaseState: {
            ...state.decreaseState,
            deltaCollateral,
          },
          formDataLoading: true,
        }));
        get().decreaseActions.calculatePositionValuesAfterDecrease(fiat, modifyPositionData);
      },

      setSlippagePct: (
        fiat: any,
        value: string,
        modifyPositionData: any,
      ) => {
        let newSlippage: BigNumber;
        if (value === null || value === '') {
          newSlippage = initialState.decreaseState.slippagePct;
        } else {
          const ceiled = Number(value) < 0 ? 0 : Number(value) > 50 ? 50 : Number(value);
          newSlippage = decToWad(floor4(ceiled / 100));
        }

        set((state) => ({
          decreaseState: { ...state.decreaseState, slippagePct: newSlippage },
          formDataLoading: true,
        }));
        get().decreaseActions.calculatePositionValuesAfterDecrease(fiat, modifyPositionData);
      },

      setDeltaDebt: (fiat, value, modifyPositionData) => {
        let newDeltaDebt: BigNumber;
        if (value === null || value === '') newDeltaDebt = initialState.decreaseState.deltaDebt;
        else newDeltaDebt = decToWad(floor4(Number(value) < 0 ? 0 : Number(value)));

        set((state) => ({
          decreaseState: {
            ...state.decreaseState,
            deltaDebt: newDeltaDebt,
          },
          formDataLoading: true,
        }));
        get().decreaseActions.calculatePositionValuesAfterDecrease(fiat, modifyPositionData);
      },

      setMaxDeltaDebt: (fiat, modifyPositionData) => {
        const deltaDebt = fiat.normalDebtToDebt(
          modifyPositionData.position.normalDebt, modifyPositionData.collateralType.state.codex.virtualRate
        );

        set(() => ({ deltaDebt, formDataLoading: true }));
        get().calculatePositionValuesAfterAction(fiat, modifyPositionData);
      },

      calculatePositionValuesAfterDecrease: debounce(async (fiat: any, modifyPositionData: any) => {
        const { collateralType, position } = modifyPositionData;
        const { tokenScale } = collateralType.properties;
        const { codex: { debtFloor } } = collateralType.settings;
        const { codex: { virtualRate: rate }, collybus: { fairPrice } } = collateralType.state;

        try {
          const { deltaCollateral, deltaDebt, slippagePct } = get().decreaseState;
          const tokenInScaled = wadToScale(deltaCollateral, tokenScale);
          let underlier = ZERO;
          if (!tokenInScaled.isZero()) {
            try {
              const underlierAmount = await userActions.collateralTokenToUnderlier(fiat, tokenInScaled, collateralType);
              underlier = underlierAmount.mul(WAD.sub(slippagePct)).div(WAD); // with slippage
            } catch (e: any) {
              if (e.reason && e.reason === 'BAL#001') {
                // Catch balancer-specific underflow error
                // https://dev.balancer.fi/references/error-codes
                throw new Error('Insufficient liquidity to convert collateral to underlier');
              }
              throw e;
            }
          }
          const deltaNormalDebt = fiat.debtToNormalDebt(deltaDebt, rate);

          if (position.collateral.lt(deltaCollateral)) set(() => ({
            formErrors: [...get().formErrors, 'Insufficient collateral']
          }));
          if (position.normalDebt.lt(deltaNormalDebt)) set(() => ({
            formErrors: [...get().formErrors, 'Insufficient debt']
          }));

          const collateral = position.collateral.sub(deltaCollateral);
          let normalDebt = position.normalDebt.sub(deltaNormalDebt);
          // override normalDebt to position.normalDebt if normalDebt is less than 1 FIAT 
          if (normalDebt.lt(WAD)) normalDebt = ZERO;
          const debt = fiat.normalDebtToDebt(normalDebt, rate);
          if (debt.gt(ZERO) && debt.lt(debtFloor)) set(() => ({
            formErrors: [
              ...get().formErrors,
              `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
            ]
          }));

          const collRatio = fiat.computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate);
          if (!(collateral.isZero() && normalDebt.isZero()) && collRatio.lte(WAD))
            set(() => ({ formErrors: [...get().formErrors, 'Collateralization Ratio has to be greater than 100%'] }));

          set((state) => ({
            decreaseState: { ...state.decreaseState, collRatio, underlier, collateral, debt },
            formDataLoading: false,
          }));
        } catch(e: any) {
          set((state) => ({
            decreaseState: {
              ...state.decreaseState,
              underlier: ZERO,
              collateral: position.collateral,
              debt: fiat.normalDebtToDebt(position.normalDebt, rate),
              collRatio: fiat.computeCollateralizationRatio(position.collateral, fairPrice, position.normalDebt, rate),
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

    /*
        ___   ____      _    ____ _____ ___ ___  _   _ ____  
       / _ \ / ___|    / \  / ___|_   _|_ _/ _ \| \ | / ___| 
      | | | | |  _    / _ \| |     | |  | | | | |  \| \___ \ 
      | |_| | |_| |  / ___ \ |___  | |  | | |_| | |\  |___) |
       \___/ \____| /_/   \_\____| |_| |___\___/|_| \_|____/ 

    */
    setMode: (mode: Mode) => { set(() => ({ mode })); },

    // Sets underlier and estimates output of bond tokens
    setUnderlier: async (fiat, value, modifyPositionData, selectedCollateralTypeId) => {
      const collateralType = modifyPositionData.collateralType;
      const underlierScale = collateralType.properties.underlierScale;
      const underlier = value === null || value === ''
        ? initialState.underlier
        : decToScale(floor4(Number(value) < 0 ? 0 : Number(value)), underlierScale);
      // Estimate output values given underlier
      set(() => ({ underlier, formDataLoading: true }));
      get().calculatePositionValuesAfterAction(fiat, modifyPositionData, selectedCollateralTypeId);
    },

    // Sets underlier and estimates output of bond tokens
    // TODO: set this using existing setUnderlier from the modal
    setMaxUnderlier: async (fiat, modifyPositionData) => {
      const underlier = modifyPositionData.underlierBalance;
      // Estimate output values given underlier
      set(() => ({
        underlier,
        formDataLoading: true,
      }));
      get().calculatePositionValuesAfterAction(fiat, modifyPositionData);
    },

    setTargetedCollRatio: (fiat, value, modifyPositionData, selectedCollateralTypeId) => {
      // Re-estimate new collateralization ratio and debt
      set(() => ({
        targetedCollRatio: decToWad(String(value)),
        formDataLoading: true,
      }));
      get().calculatePositionValuesAfterAction(fiat, modifyPositionData, selectedCollateralTypeId);
    },

    setSlippagePct: (fiat, value, modifyPositionData) => {
      let newSlippage: BigNumber;
      if (value === null || value === '') {
        newSlippage = initialState.slippagePct;
      } else {
        const ceiled = Number(value) < 0 ? 0 : Number(value) > 50 ? 50 : Number(value);
        newSlippage = decToWad(floor4(ceiled / 100));
      }
      // Re-estimate deltaCollateral
      set(() => ({  slippagePct: newSlippage, formDataLoading: true }));
      get().calculatePositionValuesAfterAction(fiat, modifyPositionData);
    },

    setDeltaCollateral: (fiat, value, modifyPositionData) => {
      let newDeltaCollateral: BigNumber;
      if (value === null || value === '') newDeltaCollateral = initialState.deltaCollateral;
      else newDeltaCollateral = decToWad(floor4(Number(value) < 0 ? 0 : Number(value)));
      // Re-estimate new collateralization ratio and debt
      set(() => ({ deltaCollateral: newDeltaCollateral, formDataLoading: true }));
      get().calculatePositionValuesAfterAction(fiat, modifyPositionData);
    },

    setMaxDeltaCollateral: (fiat, modifyPositionData) => {
      const deltaCollateral = modifyPositionData.position.collateral;
      // Re-estimate new collateralization ratio and debt
      set(() => ({ deltaCollateral, formDataLoading: true }));
      get().calculatePositionValuesAfterAction(fiat, modifyPositionData);
    },

    setDeltaDebt: (fiat, value, modifyPositionData) => {
      let newDeltaDebt: BigNumber;
      if (value === null || value === '') newDeltaDebt = initialState.deltaDebt;
      else newDeltaDebt = decToWad(floor4(Number(value) < 0 ? 0 : Number(value)));
      set(() => ({ deltaDebt: newDeltaDebt, formDataLoading: true }));
      get().calculatePositionValuesAfterAction(fiat, modifyPositionData);
    },

    setMaxDeltaDebt: (fiat, modifyPositionData) => {
      const deltaDebt = fiat.normalDebtToDebt(
        modifyPositionData.position.normalDebt, modifyPositionData.collateralType.state.codex.virtualRate
      );
      set(() => ({ deltaDebt, formDataLoading: true }));
      get().calculatePositionValuesAfterAction(fiat, modifyPositionData);
    },

    setFormDataLoading: (isLoading) => { set(() => ({ formDataLoading: isLoading })) },

    // Calculates new collateralizationRatio, collateral, debt, and deltaCollateral as needed
    // Debounced to prevent spamming RPC calls
    calculatePositionValuesAfterAction: debounce(async function (fiat: any, modifyPositionData: any, selectedCollateralTypeId?: string) {
      const { mode, calculatePositionValuesAfterRedeem } = get();

      // Reset form errors and warnings on new input
      set(() => ({ formWarnings: [], formErrors: [] }));

      if (mode === Mode.INCREASE) {
        // await calculatePositionValuesAfterIncrease(fiat, modifyPositionData);
      } else if (mode === Mode.DECREASE) {
        // await calculatePositionValuesAfterDecrease(fiat, modifyPositionData);
      } else if (mode === Mode.REDEEM) {
        await calculatePositionValuesAfterRedeem(fiat, modifyPositionData);
      } else {
        console.error('Invalid mode');
      }

      set(() => ({ formDataLoading: false }));
    }),

    // calculatePositionValuesAfterIncrease: async function (fiat: any, modifyPositionData: any) {
    //   const { collateralType, position } = modifyPositionData;
    //   const { tokenScale, underlierScale } = collateralType.properties;
    //   const { codex: { debtFloor } } = collateralType.settings;
    //   const { slippagePct, underlier } = get();
    //   const { codex: { virtualRate: rate }, collybus: { fairPrice } } = collateralType.state;

    //   try {
    //     let deltaCollateral = ZERO;
    //     if (!underlier.isZero()) {
    //       try {
    //         // Preview underlier to collateral token swap
    //         const tokensOut = await userActions.underlierToCollateralToken(fiat, underlier, collateralType);
    //         // redemption price with a 1:1 exchange rate
    //         const minTokensOut = underlier.mul(tokenScale).div(underlierScale);
    //         // apply slippagePct to preview
    //         const tokensOutWithSlippage = tokensOut.mul(WAD.sub(slippagePct)).div(WAD);
    //         // assert: minTokensOut > idealTokenOut
    //         if (tokensOutWithSlippage.lt(minTokensOut)) set(() => (
    //           { formWarnings: ['Large Price Impact (Negative Yield)'] }
    //         ));
    //         deltaCollateral = scaleToWad(tokensOut, tokenScale).mul(WAD.sub(slippagePct)).div(WAD);
    //       } catch (e: any) {
    //         if (e.reason && e.reason === 'BAL#001') {
    //           // Catch balancer-specific underflow error
    //           // https://dev.balancer.fi/references/error-codes
    //           throw new Error('Insufficient liquidity to convert underlier to collateral');
    //         }
    //         throw e;
    //       }
    //     }

    //     // Estimate new position values based on deltaDebt, taking into account an existing position's collateral
    //     const { deltaDebt } = get();
    //     const collateral = position.collateral.add(deltaCollateral);
    //     const debt = fiat.normalDebtToDebt(position.normalDebt, rate).add(deltaDebt);
    //     const normalDebt = fiat.debtToNormalDebt(debt, rate);
    //     const collRatio = fiat.computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate);

    //     if (debt.gt(ZERO) && debt.lte(collateralType.settings.codex.debtFloor) ) set(() => ({
    //       formErrors: [
    //         ...get().formErrors,
    //         `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
    //       ]
    //     }));

    //     if (debt.gt(0) && collRatio.lte(WAD)) set(() => ({
    //       formErrors: [...get().formErrors, 'Collateralization Ratio has to be greater than 100%']
    //     }));

    //     set(() => ({ collRatio, collateral, debt, deltaCollateral }));
    //   } catch (e: any) {
    //     set(() => ({
    //       deltaCollateral: ZERO,
    //       deltaDebt: ZERO,
    //       collateral: ZERO,
    //       debt: ZERO,
    //       collRatio: ZERO,
    //       formErrors: [...get().formErrors, e.message],
    //     }));
    //   }
    // },

    // calculatePositionValuesAfterDecrease: async function (fiat: any, modifyPositionData: any) {
    //   const { collateralType, position } = modifyPositionData;
    //   const { tokenScale } = collateralType.properties;
    //   const { codex: { debtFloor } } = collateralType.settings;
    //   const { codex: { virtualRate: rate }, collybus: { fairPrice } } = collateralType.state;

    //   try {
    //     const { deltaCollateral, deltaDebt, slippagePct } = get();
    //     const tokenInScaled = wadToScale(deltaCollateral, tokenScale);
    //     let underlier = ZERO;
    //     if (!tokenInScaled.isZero()) {
    //       try {
    //         const underlierAmount = await userActions.collateralTokenToUnderlier(fiat, tokenInScaled, collateralType);
    //         underlier = underlierAmount.mul(WAD.sub(slippagePct)).div(WAD); // with slippage
    //       } catch (e: any) {
    //         if (e.reason && e.reason === 'BAL#001') {
    //           // Catch balancer-specific underflow error
    //           // https://dev.balancer.fi/references/error-codes
    //           throw new Error('Insufficient liquidity to convert collateral to underlier');
    //         }
    //         throw e;
    //       }
    //     }
    //     const deltaNormalDebt = fiat.debtToNormalDebt(deltaDebt, rate);

    //     if (position.collateral.lt(deltaCollateral)) set(() => ({
    //       formErrors: [...get().formErrors, 'Insufficient collateral']
    //     }));
    //     if (position.normalDebt.lt(deltaNormalDebt)) set(() => ({
    //       formErrors: [...get().formErrors, 'Insufficient debt']
    //     }));

    //     const collateral = position.collateral.sub(deltaCollateral);
    //     let normalDebt = position.normalDebt.sub(deltaNormalDebt);
    //     // override normalDebt to position.normalDebt if normalDebt is less than 1 FIAT 
    //     if (normalDebt.lt(WAD)) normalDebt = ZERO;
    //     const debt = fiat.normalDebtToDebt(normalDebt, rate);
    //     if (debt.gt(ZERO) && debt.lt(debtFloor)) set(() => ({
    //       formErrors: [
    //         ...get().formErrors,
    //         `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
    //       ]
    //     }));

    //     const collRatio = fiat.computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate);
    //     if (!(collateral.isZero() && normalDebt.isZero()) && collRatio.lte(WAD))
    //       set(() => ({ formErrors: [...get().formErrors, 'Collateralization Ratio has to be greater than 100%'] }));

    //     set(() => ({ collRatio, underlier, collateral, debt }));
    //   } catch(e: any) {
    //     set(() => ({
    //       underlier: ZERO,
    //       collateral: position.collateral,
    //       debt: fiat.normalDebtToDebt(position.normalDebt, rate),
    //       collRatio: fiat.computeCollateralizationRatio(position.collateral, fairPrice, position.normalDebt, rate),
    //       formErrors: [...get().formErrors, e.message],
    //     }));
    //   }
    // },

    calculatePositionValuesAfterRedeem: async function (fiat: any, modifyPositionData: any) {
      const { collateralType, position } = modifyPositionData;
      const { codex: { debtFloor } } = collateralType.settings;
      const { codex: { virtualRate: rate }, collybus: { fairPrice } } = collateralType.state;

      try {
        const { deltaCollateral, deltaDebt } = get();
        const deltaNormalDebt = fiat.debtToNormalDebt(deltaDebt, rate);

        if (position.collateral.lt(deltaCollateral)) set(() => ({
          formErrors: [...get().formErrors, 'Insufficient collateral']
        }));
        if (position.normalDebt.lt(deltaNormalDebt)) set(() => ({
          formErrors: [...get().formErrors, 'Insufficient debt']
        }));

        const collateral = position.collateral.sub(deltaCollateral);
        let normalDebt = position.normalDebt.sub(deltaNormalDebt);
        // override normalDebt to position.normalDebt if normalDebt is less than 1 FIAT 
        if (normalDebt.lt(WAD)) normalDebt = ZERO;
        const debt = fiat.normalDebtToDebt(normalDebt, rate);
        if (debt.gt(ZERO) && debt.lt(debtFloor)) set(() => ({
          formErrors: [
            ...get().formErrors,
            `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
          ]
        }));
        const collRatio = fiat.computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate);
        if (!(collateral.isZero() && normalDebt.isZero()) && collRatio.lte(WAD))
          set(() => ({ formErrors: [...get().formErrors, 'Collateralization Ratio has to be greater than 100%'] }));

        set(() => ({ collRatio, collateral, debt }));
      } catch (e: any) {
        set(() => ({
          underlier: ZERO,
          collateral: position.collateral,
          debt: fiat.normalDebtToDebt(position.normalDebt, rate),
          collRatio: fiat.computeCollateralizationRatio(position.collateral, fairPrice, position.normalDebt, rate),
          formErrors: [...get().formErrors, e.message],
        }));
      }
    },

    resetCollateralAndDebtInputs: (fiat, modifyPositionData) => {
      const { deltaCollateral, deltaDebt, underlier } = initialState;
      set(() => ({ deltaCollateral, deltaDebt, underlier, formDataLoading: true }));
      get().calculatePositionValuesAfterAction(fiat, modifyPositionData);
    },

    reset: () => {
      set(initialState);
    },
  }));
