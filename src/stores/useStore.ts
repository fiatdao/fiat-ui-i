import create from 'zustand';
import { FIAT } from '@fiatdao/sdk';

const useStore = create<any>()((set: any, get: any) => ({
  fiat: null,
  fromProvider: async (provider: any) => {
    const fiatProvider = await FIAT.fromProvider(provider, null);
    set(() => ({
      fiat: fiatProvider
    }));
  },
  fromSigner: async (signer: any) => {
    const fiatSigner = await FIAT.fromSigner(signer, null);
    set(() => ({
      fiat: fiatSigner
    }));
  }
}));

export default useStore;