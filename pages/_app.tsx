import { createTheme, NextUIProvider } from '@nextui-org/react';
import {
  connectorsForWallets,
  darkTheme,
  getDefaultWallets,
  lightTheme,
  RainbowKitProvider,
} from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { argentWallet, ledgerWallet, trustWallet } from '@rainbow-me/rainbowkit/wallets';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { chain, configureChains, createClient, WagmiConfig } from 'wagmi';
import { alchemyProvider } from 'wagmi/providers/alchemy';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '../styles/global.css';

const { chains, provider, webSocketProvider } = configureChains([
    chain.mainnet, ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true' ? [chain.goerli] : [])
  ],
  [
    alchemyProvider({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY }),
  ]);

const { wallets } = getDefaultWallets({
  appName: 'FIAT I UI',
  chains,
});

const demoAppInfo = {
  appName: 'FIAT I UI',
};

const connectors = connectorsForWallets([
  ...wallets,
  {
    groupName: 'Other',
    wallets: [
      argentWallet({ chains }),
      trustWallet({ chains }),
      ledgerWallet({ chains }),
    ],
  },
]);

const wagmiClient = createClient({
  autoConnect: true,
  connectors,
  provider,
  webSocketProvider,
});

const nextLightTheme = createTheme({
  type: 'light',
  theme: {
    colors: {
      connectButtonBackground: '#FFF',
      connectButtonColor: '#25292e',
    },
    transitions:  {
      default: 'all 125ms ease',
    },
  }
})
const nextDarkTheme = createTheme({
  type: 'dark',
  theme: {
    colors: {
      connectButtonBackground: '#1a1b1f'
    },
    transitions:  {
      default: 'all 125ms ease',
    },
  }
})

const queryClient = new QueryClient()

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>FIAT I</title>
      </Head>
      <WagmiConfig client={wagmiClient}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider 
            appInfo={demoAppInfo} 
            chains={chains} 
            theme={{lightMode: lightTheme(), darkMode: darkTheme(),}}
            showRecentTransactions={true}
          >
            <NextThemesProvider 
              defaultTheme='system'
              attribute='class'
              value={{ light: nextLightTheme.className, dark: nextDarkTheme.className }}
            >
              <NextUIProvider>
                <Component {...pageProps} />
              </NextUIProvider>
            </NextThemesProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiConfig>
    </>
  );
}

export default MyApp;
