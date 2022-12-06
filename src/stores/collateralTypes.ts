import { useQuery } from '@tanstack/react-query'
import { getEarnableRate } from '../actions';
export const useCollateralTypesData = (fetchCollateralTypesAndPrices, getContracts) => {
  return useQuery(
    ['collateralTypesData', fetchCollateralTypesAndPrices, getContracts],
    async () => {
      console.log('fetch collat', fetchCollateralTypesAndPrices)
      console.log('get contracts', getContracts)
      if (!fetchCollateralTypesAndPrices || !getContracts) return [];
      const collateralTypesData_ = await fetchCollateralTypesAndPrices([]);
      console.log({collateralTypesData_})
      const earnableRates = await getEarnableRate(getContracts, collateralTypesData_);
      console.log({earnableRates})
      return collateralTypesData_
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
        })
    }, {
      enabled: !!fetchCollateralTypesAndPrices && !!getContracts
    }
  )
}