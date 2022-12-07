import { Text } from '@nextui-org/react';
import { ReactNode } from 'react';
import { InfoIcon } from './icons/Info';
import { WarningIcon } from './icons/Warning';

// TODO: Copy message to clipboard on click (like aave), or guarantee human readable messages
export const Alert = ({ severity, message }: { severity: 'error' | 'warning', message: ReactNode }) => {
  return (
    <div
      style={{
        width: '100%',
        border: `1px solid var(--nextui-colors-${severity})`,
        borderRadius: 'var(--nextui-radii-md)',
        padding: '.5rem 1rem .5rem 1rem',
        overflow: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {severity === 'error' ? <InfoIcon fill={`var(--nextui-colors-${severity})`} /> : severity === 'warning' ? <WarningIcon fill={`var(--nextui-colors-${severity})`} /> : null}
        </div>
        <Text
          color={severity}
          style={{
            maxWidth: '40ch',
            textAlign: 'left',
            marginLeft: '0.5rem',
            fontSize: 'var(--nextui-fontSizes-sm)',
          }}
        >
          {message}
        </Text>
      </div>
    </div>
  );
};
