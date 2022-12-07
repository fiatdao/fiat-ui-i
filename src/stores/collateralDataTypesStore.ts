import create from 'zustand';
import { getEarnableRate } from '../actions';

const useCollateralTypesData = create<any>()((set: any, get: any) => ({
  collateralTypesData: [],
  loadingCollateralTypesData: false,
  resetCollateralTypesData: () => {
    set(() => ({
      collateralTypesData: [],
      loadingCollateralTypesData: false
    }));
  },
  getCollateralTypesData: async (fiat: any) => {
    const loading = get().loadingCollateralTypesData;
    if (!fiat || loading) return;
    set(() => ({ loadingCollateralTypesData: true }))
    console.log('Fetch Collateral Data Types')
    try {
      const collateralTypesData_ = await fiat.fetchCollateralTypesAndPrices([]);
      const earnableRates = await getEarnableRate(fiat, collateralTypesData_);
  
      const newData = collateralTypesData_
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
        });

      set(() => ({
        collateralTypesData: newData,
        loadingCollateralTypesData: false
      }));
    } catch (e) {
      console.log(e)
      set(() => ({ loadingCollateralTypesData: false }))
    }
  }
}));

export default useCollateralTypesData;