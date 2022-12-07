import { computeCollateralizationRatio, normalDebtToDebt, wadToDec } from '@fiatdao/sdk';
import { Input, Loading, Text } from '@nextui-org/react';
import 'antd/dist/antd.css';
import { BigNumber, ethers } from 'ethers';
import { floor2, floor5 } from '../../utils';

export const PositionPreview = ({
  formDataLoading,
  positionCollateral,
  positionNormalDebt,
  estimatedCollateral,
  estimatedCollateralRatio,
  estimatedDebt,
  virtualRate,
  fairPrice,
  symbol,
}: {
  formDataLoading: boolean,
  positionCollateral: BigNumber,
  positionNormalDebt: BigNumber,
  estimatedCollateral: BigNumber,
  estimatedCollateralRatio: BigNumber,
  estimatedDebt: BigNumber,
  virtualRate: BigNumber,
  fairPrice: BigNumber,
  symbol: string,
}) => {
  return (
    <>
      <Text b size={'m'}>
        Position Preview
      </Text>
      <Input
        readOnly
        value={(formDataLoading)
          ? ' '
          : `${floor2(wadToDec(positionCollateral))} → ${floor2(wadToDec(estimatedCollateral))}`
        }
        placeholder='0'
        type='string'
        label={`Collateral (before: ${floor2(wadToDec(positionCollateral))} ${symbol})`}
        labelRight={symbol}
        contentLeft={formDataLoading ? <Loading size='xs' /> : null}
        size='sm'
        status='primary'
      />
      <Input
        readOnly
        value={(formDataLoading)
          ? ' '
          : `${floor5(wadToDec(normalDebtToDebt(positionNormalDebt, virtualRate)))} → ${floor5(wadToDec(estimatedDebt))}`
        }
        placeholder='0'
        type='string'
        label={`Debt (before: ${floor5(wadToDec(normalDebtToDebt(positionNormalDebt, virtualRate)))} FIAT)`}
        labelRight={'FIAT'}
        contentLeft={formDataLoading ? <Loading size='xs' /> : null}
        size='sm'
        status='primary'
      />
      <Input
        readOnly
        value={(() => {
          if (formDataLoading) return ' ';
          let collRatioBefore = computeCollateralizationRatio(
            positionCollateral, fairPrice, positionNormalDebt, virtualRate
          );
          collRatioBefore = (collRatioBefore.eq(ethers.constants.MaxUint256))
            ? '∞' : `${floor2(wadToDec(collRatioBefore.mul(100)))}%`;
            const collRatioAfter = (estimatedCollateralRatio.eq(ethers.constants.MaxUint256))
              ? '∞' : `${floor2(wadToDec(estimatedCollateralRatio.mul(100)))}%`;
              return `${collRatioBefore} → ${collRatioAfter}`;
        })()}
        placeholder='0'
        type='string'
        label={
          `Collateralization Ratio (before: ${(() => {
          const collRatio = computeCollateralizationRatio(
            positionCollateral, fairPrice, positionNormalDebt, virtualRate
          );
          if (collRatio.eq(ethers.constants.MaxUint256)) return '∞'
            return floor2(wadToDec(collRatio.mul(100)));
        })()
        }%)`
        }
        labelRight={'🚦'}
        contentLeft={formDataLoading ? <Loading size='xs' /> : null}
        size='sm'
        status='primary'
      />
    </>
  );
}
