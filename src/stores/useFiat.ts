import { useQuery } from '@tanstack/react-query'
import { FIAT } from '@fiatdao/sdk'

export const useFiat = (provider, signer) => {
    return useQuery(
        ['fiat'],
        () => {
            console.log('fiat query', signer)
            if (signer) return FIAT.fromSigner(signer, null)
            console.log('from provider')
            return FIAT.fromProvider(provider, null)
        },
    )
}