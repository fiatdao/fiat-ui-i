import { Input, InputProps } from '@nextui-org/react';

// TODO: Next UI input appears to be uncontrolled. It's ignoring me completely. try radix input i guess?
export const NumericInput = (props: InputProps) => {
  return (
    <Input
      {...props}
      onChange={(event) => {
        if (props.onChange) {
          // can replace event.target.value here
          props.onChange(event);
        }
      }}
      pattern="/^\d*\.?\d*$/"
      placeholder='0'
      inputMode='decimal'
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      maxLength={64}
    />
  );
}
