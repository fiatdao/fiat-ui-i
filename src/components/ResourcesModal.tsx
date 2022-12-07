import { Link, Modal, Text } from '@nextui-org/react';
import React from 'react';

const links = [
  {
    text: 'Old App',
    url: 'https://app.fiatdao.com',
  },
  {
    text: 'FIAT-USDC-DAI Balancer Pool',
    url: 'https://app.balancer.fi/#/ethereum/pool/0x178e029173417b1f9c8bc16dcec6f697bc32374600000000000000000000025d',
  },
  {
    text: 'Website',
    url: 'https://fiatdao.com/',
  },
  {
    text: 'Discord',
    url: 'https://discord.gg/5JqBMtc4fm',
  },
  {
    text: 'Governance',
    url: 'https://gov.fiatdao.com',
  },
  {
    text: 'Audits',
    url: 'https://github.com/fiatdao/security/tree/main/audits',
  },
  {
    text: 'Documentation',
    url: 'https://docs.fiatdao.com',
  },
  {
    text: 'Github',
    url: 'https://github.com/fiatdao',
  }
];

const linkCss = {
  fontFamily: 'var(--rk-fonts-body)',
  fontWeight: 700,
  color: '$connectButtonColor',
  width: '100%'
}

const headerCss = {
  fontFamily: 'var(--rk-fonts-body)',
  fontWeight: 800,
  color: '$connectButtonColor',
}

export const ResourcesModal = (props: any) => {
  return (
    <Modal
      closeButton
      aria-labelledby="modal-title"
      open={props.open}
      onClose={props.onClose}
    >
      <Modal.Header css={{justifyContent: 'space-between'}}>
        <Text id="modal-title" size={18} css={headerCss}>
          Resources
        </Text>
      </Modal.Header>
      <Modal.Body css={{paddingTop: '0px'}}>
        {links.map((item) => {
          return (
            <Link 
              isExternal
              href={item.url} 
              key={item.url} 
              target='_blank' 
              rel='noreferrer noopener'
              css={linkCss}
            >
              {item.text}
            </Link>
          )
        })}
      </Modal.Body>
    </Modal>
  );
}
