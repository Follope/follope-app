import { View, Text, TextInput, type TextInputProps } from 'react-native';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';

interface FormInputProps<T extends FieldValues> extends Omit<TextInputProps, 'value' | 'onChangeText'> {
  control: Control<T>;
  name: Path<T>;
  label: string;
}

export function FormInput<T extends FieldValues>({ control, name, label, ...inputProps }: FormInputProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value }, fieldState: { error } }) => (
        <View className="mb-4">
          <Text className="text-sm text-neutral-600 dark:text-neutral-400 mb-1.5">{label}</Text>
          <TextInput
            cursorColor="#FF7A00"
            selectionColor="rgba(255, 122, 0, 0.3)"
            textAlignVertical={inputProps.multiline ? 'top' : 'center'}
            {...inputProps}
            value={typeof value === 'string' ? value : value != null ? String(value) : ''}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholderTextColor="#6B6B6B"
            className={`${inputProps.multiline ? 'min-h-[96px] py-3' : 'h-12'} rounded-xl bg-neutral-50 dark:bg-card border px-4 text-base text-neutral-900 dark:text-white ${
              error ? 'border-red-500' : 'border-neutral-200 dark:border-border'
            }`}
          />
          {error && <Text className="text-xs text-red-500 mt-1">{error.message}</Text>}
        </View>
      )}
    />
  );
}
