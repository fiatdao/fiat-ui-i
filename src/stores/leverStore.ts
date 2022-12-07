import { decToScale, decToWad, ZERO } from '@fiatdao/sdk';
import { BigNumber } from 'ethers';
import create from 'zustand';
import { debounce, floor4 } from '../utils';

/// A store for setting and getting form values to create and manage positions.
interface LeverState {
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
        // TODO:
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
        // TODO:
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
