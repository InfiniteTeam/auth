import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function RedirectUriFields({
  id,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={`${id}-0`}>리다이렉트 URL</Label>
      {value.map((uri, index) => (
        <div key={index} className="flex flex-wrap gap-2">
          <Input
            id={`${id}-${index}`}
            type="url"
            aria-label={`리다이렉트 URL ${index + 1}`}
            value={uri}
            onChange={(event) =>
              onChange(value.map((item, i) => (i === index ? event.target.value : item)))
            }
            placeholder="https://app.example.com/callback"
            className="min-w-0 flex-1 basis-52"
            disabled={disabled}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || value.length === 1}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
            aria-label={`${index + 1}번째 리다이렉트 URL 삭제`}
          >
            삭제
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="self-start"
        disabled={disabled}
        onClick={() => onChange([...value, ''])}
      >
        Redirect URL 추가
      </Button>
    </div>
  );
}
