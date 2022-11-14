import { Badge, Button, Link, Loading } from '@nextui-org/react';
import { useState } from 'react';
import Skeleton from 'react-loading-skeleton';

interface ProxyCardProps {
  createProxy: (fiat: any, user: string) => any;
  proxies: Array<string>;
  explorerUrl: null | string;
  fiat: any;
  user: null | string;
  disableActions: boolean;
  transactionData: any;
}

export const ProxyButton = (props: ProxyCardProps) => {
  const [error, setError] = useState('');

  if (props.user === null || !props.fiat) {
    return <Skeleton count={2} />
  }

  if (props.proxies.length > 0) {
    return (
      <Badge
        style={{marginRight: '10px'}} 
        css={{
          fontFamily: 'var(--rk-fonts-body)',
          fontWeight: 700,
          fontSize: '100%',
          borderRadius: '12px',
          backgroundColor: '$connectButtonBackground',
          color: '$connectButtonColor',
          boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
          '&:hover': {
            transform: 'scale(1.03)'
          },
          border: 'none',
        }}      
      >
        <Link
          target='_blank'
          href={`${props.explorerUrl}/address/${props.proxies[0]}`}
          isExternal={true}
          css={{
            color: '$connectButtonColor',
          }}
        >
          Proxy: {`${props.proxies[0].substring(0,4)}...${props.proxies[0].slice(-4)}`}&nbsp;
        </Link>
      </Badge>

    )
  }

  return (
    <Button
      onPress={async () => {
        if (props.user === null) {
          console.warn('ProxyButton requires a user');
        } else {
          try {
            setError('');
            await props.createProxy(props.fiat, props.user);
          } catch (e: any) {
            setError(e.message);
          }
        }
      }}
      disabled={props.disableActions}
      style={{marginRight: '10px'}} 
      icon={
        [
          'createProxy',
        ].includes(props.transactionData.action || '') && props.disableActions ? (
          <Loading size='xs' />
        ) : null
      }
      css={{
        fontFamily: 'var(--rk-fonts-body)',
        fontWeight: 700,
        fontSize: '100%',
        borderRadius: '12px',
        backgroundColor: '$connectButtonBackground',
        color: '$connectButtonColor',
        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
        '&:hover': {
          transform: 'scale(1.03)'
        },
        width: 'var(--nextui-space-60)',
      }}
    >
      {error === '' ? 'Create Proxy Account'
      : (
        'Error, please try again'
      )}
    </Button>
  );
};
