import { styled } from '@nextui-org/react';
import { Label } from '@radix-ui/react-label';
import * as RadixSlider from '@radix-ui/react-slider';
import type * as Stitches from '@stitches/react';
import { ReactNode } from 'react';

const RadixSliderRoot = styled(RadixSlider.Root, {
  cursor: 'pointer',
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
  userSelect: 'none',
  touchAction: 'none',
  width: '100%',
  '&[data-orientation="horizontal"]': { height: '20px' },
  '&[data-disabled]': { cursor: 'not-allowed' },
});

const RadixSliderLabels = styled('div', {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: 'var(--nextui-space-1)',
  // extend labels slightly past edges of slider
  width: 'calc(100% + 0.75rem)',
  // center labels on track
  marginLeft: 'calc(0.375rem * -1)',
});

const SliderLabel = styled(Label,{
  fontSize: 'var(--nextui-fontSizes-xs)',
  lineHeight: 'var(--nextui-lineHeights-xs)',
  color: 'var(--nextui-colors-gray600)',
});

const RadixSliderTrack = styled(RadixSlider.Track, {
  position: 'relative',
  backgroundColor: 'var(--nextui-colors-gray300)',
  flexGrow: '1',
  height: '100%',
  borderRadius: '4px',
  '&[data-orientation="horizontal"]': { height: '3px' },
  '&[data-disabled]': { opacity: 0.5 },

  variants: {
    color: {
      gradient: {
        backgroundImage:
          'linear-gradient(90deg, var(--nextui-colors-error) 0%, var(--nextui-colors-warning) 5%, var(--nextui-colors-success) 100%)',
        '&[data-inverted]': {
          backgroundImage:
            'linear-gradient(90deg, var(--nextui-colors-success) 0%, var(--nextui-colors-warning) 95%, var(--nextui-colors-error) 100%)',
        },
      },
    },
  },
});

const RadixSliderRange = styled(RadixSlider.Range, {
  position: 'absolute',
  borderRadius: '9999px',
  height: '100%',
});

const RadixSliderThumb = styled(RadixSlider.Thumb, {
  display: 'block',
  width: 'var(--nextui-space-6)',
  height: 'var(--nextui-space-6)',
  backgroundColor: 'white',
  borderRadius: '100%',
  boxShadow: '0 0 0 2px var(--nextui-colors-primary)',

  '&:focus': {
    outline: 'none',
    boxShadow: '0 0 0 2px var(--nextui-colors-primaryBorder)',
  },
  '&[data-disabled]': { background: 'black' },
});

interface BaseSliderProps extends RadixSlider.SliderProps {
  // Override `color` type from RadixSlider.SliderProps to `any`
  color?: any;
  maxLabel?: ReactNode;
  minLabel?: ReactNode;
  orientation?: 'horizontal';
}

interface SliderProps extends BaseSliderProps {
  // Narrow `color` type to only allow the specific variants in RadixSliderTrack
  // This allows autocomplete engines to suggest your color variants when using the Slider component's `color` prop
  color?: Stitches.VariantProps<typeof RadixSliderTrack>['color'];
}

export const Slider = (props: SliderProps) => {
  const {
    'aria-label': ariaLabel,
    color,
    disabled,
    inverted,
    max,
    maxLabel,
    min,
    minLabel,
    onValueChange,
    step,
    value,
  } = props;

  return (
    <>
      <RadixSliderRoot
        aria-label={ariaLabel}
        disabled={disabled}
        inverted={inverted}
        max={max}
        min={min}
        onValueChange={onValueChange}
        step={step}
        value={value}
      >
        <RadixSliderTrack data-inverted={inverted} color={color}>
          <RadixSliderRange />
        </RadixSliderTrack>
        <RadixSliderThumb />
      </RadixSliderRoot>

      <RadixSliderLabels>
        <SliderLabel>{inverted ? maxLabel : minLabel}</SliderLabel>
        <SliderLabel>{inverted ? minLabel : maxLabel}</SliderLabel>
      </RadixSliderLabels>
    </>
  );
};
