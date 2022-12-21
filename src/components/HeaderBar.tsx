import React from 'react';
import { Badge, Button, Link, Text, Tooltip } from '@nextui-org/react';
import { InfoIcon } from './icons/Info';
import { connectButtonCSS, ProxyButton } from './ProxyButton';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { ResourcesModal } from './ResourcesModal';
import { queryMeta } from '@fiatdao/sdk';
import { chain as chains, useAccount, useBlockNumber, useNetwork } from 'wagmi';
import { useFiatBalance } from '../state/queries/useFiatBalance';
import useStore from '../state/stores/globalStore';

interface BlockSyncStatus {
  subgraphBlockNumber: number;
  providerBlockNumber: number;
  blockDiff: number;
  status: 'success' | 'warning' | 'error' | undefined;
  message: string;
}

export const HeaderBar = (props: any) => {
  const [showResourcesModal, setShowResourcesModal] = React.useState<boolean>(false);
  const [syncStatus, setSyncStatus] = React.useState<BlockSyncStatus>();
  const {data: providerBlockNumber, refetch} = useBlockNumber();

  const fiat = useStore((state) => state.fiat);

  const { chain } = useNetwork();
  const { address } = useAccount();
  const { data: fiatBalance } = useFiatBalance(fiat, chain?.id ?? chains.mainnet.id, address ?? '');

  const queryBlockNumber = React.useCallback(async () => {
    if (!fiat) return;
    if (!providerBlockNumber) return;
    const { _meta } = await fiat.query(queryMeta);
    const subgraphBlockNumber = _meta?.block.number;
    const blockDiff = providerBlockNumber - subgraphBlockNumber;
    const status = blockDiff > 5 ? 'error' : blockDiff > 0 ? 'warning' : 'success';
    const message = blockDiff === 0 ? 'Synced' : `Syncing (${blockDiff} block${(blockDiff === 1) ? '' : 's'} behind)`
    setSyncStatus({
      subgraphBlockNumber,
      providerBlockNumber,
      blockDiff,
      status,
      message,
    });
  }, [fiat, providerBlockNumber])

  React.useEffect(() => {
    queryBlockNumber();
    const timer = setInterval(() => {
      refetch();
      queryBlockNumber();
    }, 10000);
    return () => clearInterval(timer);
  }, [fiat, queryBlockNumber, refetch])

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex',
        padding: '6px 20px 6px 12px',
        borderBottom: '1px solid var(--nextui-colors-border)',
        width: '100%',
        justifyContent: 'space-between'
      }}>
        <Link href={'https://fiatdao.com'} target='_blank' rel='noreferrer noopener' >
         <Text size='$xs'>FIAT DAO - FIAT I</Text>
        </Link>
        <Tooltip content={syncStatus?.message} placement='left' css={{ whiteSpace: 'nowrap' }}>
          <Badge color={syncStatus?.status ?? 'default'} variant='dot' css={{ alignSelf: 'center', marginRight: '3px' }}/>
          <Text size='$xs'>
            {syncStatus?.subgraphBlockNumber}
          </Text>
        </Tooltip>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 0 }}>
        <div></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 16 }}>
          <div style={{ display: 'flex', height: '40px' }}>
            <Button 
              auto
              icon={<InfoIcon fill='var(--nextui-colors-foreground)' width='20' height='20'/>}
              css={connectButtonCSS}
              onPress={()=>setShowResourcesModal(true)}
            />
            <ProxyButton
              createProxy={props.createProxy}
            />
            {(fiatBalance) && 
              <Badge css={connectButtonCSS} >
                <Link
                  href={'https://app.balancer.fi/#/ethereum/pool/0x178e029173417b1f9c8bc16dcec6f697bc32374600000000000000000000025d'}
                  target='_blank'
                  rel='noreferrer noopener'
                  color='text'
                  >
                    {fiatBalance}
                </Link>
              </Badge>
            }
            <div className='connectWrapper'>
              <ConnectButton showBalance={false} />
            </div>
          </div>
          <ResourcesModal 
            open={showResourcesModal}
            onClose={() => setShowResourcesModal(false)}
          />
        </div>
      </div>
    </div>
  );
}
