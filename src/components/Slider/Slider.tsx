import { styled } from '@nextui-org/react';
import { Label } from '@radix-ui/react-label';
import * as RadixSlider from '@radix-ui/react-slider';
import type * as Stitches from '@stitches/react';
import styles from './Slider.module.css';

const RadixSliderTrack = styled(RadixSlider.Track, {
  position: 'relative',
  backgroundColor: 'white',
  flexGrow: '1',
  height: '100%',
  borderRadius: '4px',
  '&[data-orientation="horizontal"]': { height: '3px' },
  '&[data-orientation="vertical"]': { width: '3px' },
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

interface BaseSliderProps extends RadixSlider.SliderProps {
  maxLabel?: string;
  minLabel?: string;
  // Override `color` type from RadixSlider.SliderProps to `any`
  color?: any;
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
      <RadixSlider.Root
        aria-label={ariaLabel}
        disabled={disabled}
        className={styles.SliderRoot}
        inverted={inverted}
        max={max}
        min={min}
        onValueChange={onValueChange}
        step={step}
        value={value}
      >
        <RadixSliderTrack data-inverted={inverted} color={color}>
          <RadixSlider.Range className={styles.SliderRange} />
        </RadixSliderTrack>
        <RadixSlider.Thumb className={styles.SliderThumb} />
      </RadixSlider.Root>

      <div className={styles.SliderLabels}>
        <Label className={styles.SliderLabel}>{inverted ? maxLabel : minLabel}</Label>
        <Label className={styles.SliderLabel}>{inverted ? minLabel : maxLabel}</Label>
      </div>
    </>
  );
};
