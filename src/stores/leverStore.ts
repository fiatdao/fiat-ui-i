import {
  applySwapSlippage,
  computeCollateralizationRatio,
  computeLeveredDeposit,
  debtToNormalDebt,
  decToScale,
  decToWad,
  maxCRForLeveredDeposit,
  minCRForLeveredDeposit,
  normalDebtToDebt,
  scaleToDec,
  scaleToWad,
  WAD,
  wadToDec,
  wadToScale,
  ZERO,
} from '@fiatdao/sdk';
import { BigNumber } from 'ethers';
import create from 'zustand';
import * as userActions from '../actions';
import { debounce, floor4 } from '../utils';

export const enum Mode {
  CREATE='create',
  INCREASE='increase',
  DECREASE='decrease',
  REDEEM='redeem',
}

/// A store for setting and getting form values to create and manage positions.
interface LeverState {
  mode: Mode; // [deposit, withdraw, redeem]
  formDataLoading: boolean;
  formWarnings: string[];
  formErrors: string[];
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
  redeemState: {
    underlier: BigNumber; // [underlierScale]
    slippagePct: BigNumber; // [wad]
    collateral: BigNumber; // [wad]
    collRatio: BigNumber; // [wad] estimated new collateralization ratio
    debt: BigNumber; // [wad]
    deltaCollateral: BigNumber; // [wad]
    deltaDebt: BigNumber; // [wad]
  };
}

interface LeverActions {
  setMode: (mode: Mode) => void;
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
  redeemActions: {
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
    calculatePositionValuesAfterRedeem: (
      fiat: any,
      modifyPositionData: any,
    ) => void;
  },
}

const initialState = {
  mode: Mode.INCREASE,
  formDataLoading: false,
  formWarnings: [],
  formErrors: [],
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
  redeemState: {
    underlier: ZERO,
    slippagePct: decToWad('0.001'),
    targetedCollRatio: decToWad('1.2'),
    collateral: ZERO, // [wad]
    collRatio: ZERO, // [wad] estimated new collateralization ratio
    debt: ZERO, // [wad]
    deltaCollateral: ZERO,
    deltaDebt: ZERO, // [wad]
  },
};

export const useLeverStore = create<LeverState & LeverActions>()((set, get) => ({
    ...initialState,

    setMode: (mode: Mode) => { set(() => ({ mode })); },

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

      calculatePositionValuesAfterCreation: debounce(async function (fiat: any, modifyPositionData: any) {
        console.log('fmof');
        const { collateralType } = modifyPositionData;
        const { tokenScale, underlierScale } = collateralType.properties;
        const { codex: { debtFloor }, collybus: { liquidationRatio } } = collateralType.settings;
        const { slippagePct, underlier, targetedCollRatio } = get().createState;
        const { codex: { virtualRate: rate }, collybus: { fairPrice, faceValue } } = collateralType.state;

        // Reset form errors and warnings on new input
        set(() => ({ formWarnings: [], formErrors: [] }));

        try {
            
          // calculate exchange rates
          const fiatToUnderlierRateIdeal = decToScale(1, underlierScale); // TODO: use userActions.fiatToUnderlier()
          const underlierToCollateralRateIdeal = await userActions.underlierToCollateralToken(
            fiat, decToScale(1, underlierScale), collateralType
          );
          const flashloanIdeal = computeLeveredDeposit(
            ZERO,
            ZERO,
            rate,
            fairPrice,
            scaleToWad(fiatToUnderlierRateIdeal, underlierScale),
            scaleToWad(underlierToCollateralRateIdeal, tokenScale),
            scaleToWad(underlier, underlierScale),
            targetedCollRatio
          );
          // sum of upfront underliers and underliers bought via flashloan
          const underlierIn = underlier.add(
            wadToScale(flashloanIdeal, underlierScale).mul(fiatToUnderlierRateIdeal).div(underlierScale)
          );
          const collateralOut = await userActions.underlierToCollateralToken(fiat, underlierIn, collateralType);
          const underlierToCollateralRateWithPriceImpact = applySwapSlippage(
            scaleToWad(collateralOut, tokenScale).mul(WAD).div(scaleToWad(underlierIn, underlierScale)),
            slippagePct
          );
          const fiatToUnderlierRateWithPriceImpact = applySwapSlippage(WAD, slippagePct); // TODO: use userActions.fiatToUnderlier() with scaleToWad

          let minCollRatio = minCRForLeveredDeposit(
            faceValue, fiatToUnderlierRateWithPriceImpact, underlierToCollateralRateWithPriceImpact
          );
          if (minCollRatio.lt(liquidationRatio)) minCollRatio = liquidationRatio;
          const maxCollRatio = maxCRForLeveredDeposit(
            ZERO, ZERO, rate, faceValue, underlierToCollateralRateWithPriceImpact, scaleToWad(underlier, underlierScale)
          );

          // calculate actual flashloan amount
          const flashloan = computeLeveredDeposit(
            ZERO,
            ZERO,
            rate,
            fairPrice,
            fiatToUnderlierRateWithPriceImpact,
            underlierToCollateralRateWithPriceImpact,
            scaleToWad(underlier, underlierScale),
            targetedCollRatio
          );

          const deltaDebt = flashloan; // includes price impact and slippage
          const deltaNormalDebt = debtToNormalDebt(deltaDebt, rate);
          const deltaCollateral = applySwapSlippage(scaleToWad(collateralOut, tokenScale), slippagePct);
          const collateral = deltaCollateral;
          const debt = deltaDebt;
          const collRatio = computeCollateralizationRatio(collateral, fairPrice, deltaNormalDebt, rate);

          if (deltaDebt.gt(ZERO) && deltaDebt.lte(debtFloor)) set(() => ({
            formErrors: [
              ...get().formErrors,
              `This collateral type requires a minimum of ${wadToDec(debtFloor)} FIAT to be borrowed`
            ]
          }));
          if (debt.gt(0) && collRatio.lte(WAD)) set(() => ({
            formErrors: [...get().formErrors, 'Collateralization Ratio has to be greater than 100%']
          }));

          const newCreateFormState = {
            collateral, collRatio, debt, deltaCollateral, deltaDebt, minCollRatio, maxCollRatio
          };
          set((state) => ({
            createState: { ...state.createState, ...newCreateFormState },
            formDataLoading: false,
          }));
        } catch (e: any) {
          console.log(e);
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
        console.log('fmof');
        const { collateralType, position } = modifyPositionData;
        const { tokenScale, underlierScale } = collateralType.properties;
        const { codex: { debtFloor } } = collateralType.settings;
        const { slippagePct, underlier } = get().increaseState;
        const { codex: { virtualRate: rate }, collybus: { fairPrice } } = collateralType.state;

        // Reset form errors and warnings on new input
        set(() => ({ formWarnings: [], formErrors: [] }));

        try {
          // const deltaCollateral = ZERO;
          // if (!underlier.isZero()) {
          //   try {
          //     // Preview underlier to collateral token swap
          //     const tokensOut = await userActions.underlierToCollateralToken(fiat, underlier, collateralType);
          //     // redemption price with a 1:1 exchange rate
          //     const minTokensOut = underlier.mul(tokenScale).div(underlierScale);
          //     // apply slippagePct to preview
          //     const tokensOutWithSlippage = tokensOut.mul(WAD.sub(slippagePct)).div(WAD);
          //     // assert: minTokensOut > idealTokenOut
          //     if (tokensOutWithSlippage.lt(minTokensOut)) set(() => (
          //       { formWarnings: ['Large Price Impact (Negative Yield)'] }
          //     ));
          //     deltaCollateral = scaleToWad(tokensOut, tokenScale).mul(WAD.sub(slippagePct)).div(WAD);
          //   } catch (e: any) {
          //     if (e.reason && e.reason === 'BAL#001') {
          //       // Catch balancer-specific underflow error
          //       // https://dev.balancer.fi/references/error-codes
          //       throw new Error('Insufficient liquidity to convert underlier to collateral');
          //     }
          //     throw e;
          //   }
          // }

          // calculate exchange rates
          const fiatToUnderlierRateIdeal = WAD; // TODO: use userActions.fiatToUnderlier()
          const underlierToCollateralRateIdeal = await userActions.underlierToCollateralToken(
            fiat, decToScale(1, underlierScale), collateralType
          );
          const flashloanIdeal = computeLeveredDeposit(
            position.collateral,
            position.normalDebt,
            rate,
            fairPrice,
            fiatToUnderlierRateIdeal,
            scaleToWad(underlierToCollateralRateIdeal, tokenScale),
            modifyPositionData.underlier,
            modifyPositionData.targetedCollRatio
          );
          const underlierIn = underlier.add(
            wadToScale(flashloanIdeal.mul(fiatToUnderlierRateIdeal).div(WAD), underlierScale)
          );
          const collateralOut = await userActions.underlierToCollateralToken(fiat, underlierIn, collateralType);
          const underlierToCollateralRateWithPriceImpact = scaleToWad(collateralOut, tokenScale).mul(WAD).div(
            scaleToWad(underlierIn, underlierScale)
          );
          // TODO: apply price impact from swapping flashloanIdeal to underlier
          const fiatToUnderlierRateWithPriceImpact = flashloanIdeal; // TODO: use userActions.fiatToUnderlier()

          // calculate actual flashloan amount
          const flashloan = computeLeveredDeposit(
            position.collateral,
            position.normalDebt,
            rate,
            fairPrice,
            applySwapSlippage(fiatToUnderlierRateWithPriceImpact, slippagePct),
            applySwapSlippage(underlierToCollateralRateWithPriceImpact, slippagePct),
            modifyPositionData.underlier,
            modifyPositionData.targetedCollRatio
          );

          console.log(flashloan.toString())
          
          const deltaCollateral = applySwapSlippage(collateralOut, slippagePct);

          // Estimate new position values based on deltaDebt, taking into account an existing position's collateral
          const deltaDebt = flashloan;
          const collateral = position.collateral.add(deltaCollateral);
          const debt = normalDebtToDebt(position.normalDebt, rate).add(deltaDebt);
          const normalDebt = debtToNormalDebt(debt, rate);
          const collRatio = computeCollateralizationRatio(collateral, fairPrice, normalDebt, rate);

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
          console.log(e);
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

        set((state) => ({ decreaseState: { ...state.decreaseState, deltaDebt }, formDataLoading: true }));
        get().decreaseActions.calculatePositionValuesAfterDecrease(fiat, modifyPositionData);
      },

      calculatePositionValuesAfterDecrease: debounce(async (fiat: any, modifyPositionData: any) => {
        // TODO:
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
        let newDeltaCollateral: BigNumber;
        if (value === null || value === '') newDeltaCollateral = initialState.redeemState.deltaCollateral;
        else newDeltaCollateral = decToWad(floor4(Number(value) < 0 ? 0 : Number(value)));

        // Re-estimate new collateralization ratio and debt
        set((state) => ({
          redeemState: {
            ...state.redeemState,
            deltaCollateral: newDeltaCollateral,
          },
          formDataLoading: true,
        }));
        get().redeemActions.calculatePositionValuesAfterRedeem(fiat, modifyPositionData);
      },

      setMaxDeltaCollateral: (fiat, modifyPositionData) => {
        const deltaCollateral = modifyPositionData.position.collateral;

        // Re-estimate new collateralization ratio and debt
        set((state) => ({
          redeemState: {
            ...state.redeemState,
            deltaCollateral,
          },
          formDataLoading: true,
        }));
        get().redeemActions.calculatePositionValuesAfterRedeem(fiat, modifyPositionData);
      },

      setSlippagePct: (
        fiat: any,
        value: string,
        modifyPositionData: any,
      ) => {
        let newSlippage: BigNumber;
        if (value === null || value === '') {
          newSlippage = initialState.redeemState.slippagePct;
        } else {
          const ceiled = Number(value) < 0 ? 0 : Number(value) > 50 ? 50 : Number(value);
          newSlippage = decToWad(floor4(ceiled / 100));
        }

        set((state) => ({
          redeemState: { ...state.redeemState, slippagePct: newSlippage },
          formDataLoading: true,
        }));
        get().redeemActions.calculatePositionValuesAfterRedeem(fiat, modifyPositionData);
      },

      setDeltaDebt: (fiat, value, modifyPositionData) => {
        let newDeltaDebt: BigNumber;
        if (value === null || value === '') newDeltaDebt = initialState.redeemState.deltaDebt;
        else newDeltaDebt = decToWad(floor4(Number(value) < 0 ? 0 : Number(value)));

        set((state) => ({
          redeemState: {
            ...state.redeemState,
            deltaDebt: newDeltaDebt,
          },
          formDataLoading: true,
        }));
        get().redeemActions.calculatePositionValuesAfterRedeem(fiat, modifyPositionData);
      },

      setMaxDeltaDebt: (fiat, modifyPositionData) => {
        const deltaDebt = fiat.normalDebtToDebt(
          modifyPositionData.position.normalDebt, modifyPositionData.collateralType.state.codex.virtualRate
        );

        set((state) => ({ redeemState: { ...state.redeemState, deltaDebt }, formDataLoading: true }));
        get().redeemActions.calculatePositionValuesAfterRedeem(fiat, modifyPositionData);
      },

      calculatePositionValuesAfterRedeem: debounce(async (fiat: any, modifyPositionData: any) => {
        // TODO:
      }),
    },
  }));
