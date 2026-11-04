import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useExportStore } from '@/store/export-store';

const connectionSchema = z.object({
  url: z.url({
    message: 'Enter a valid Sisense instance URL, e.g. https://your-instance.sisense.com',
  }),
  token: z.string().trim().min(1, 'API token is required'),
});

type ConnectionFormValues = z.infer<typeof connectionSchema>;

export function ConnectionForm() {
  const connect = useExportStore((s) => s.connect);
  const prefill = useExportStore((s) => s.connectionPrefill);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionSchema),
    defaultValues: { url: prefill.url ?? '', token: prefill.token ?? '' },
  });

  const onSubmit = (values: ConnectionFormValues) => {
    connect(values);
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Connect to Sisense</CardTitle>
        <CardDescription>
          Enter your Sisense instance URL and API token to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="url">Sisense URL</Label>
            <Input
              id="url"
              type="text"
              placeholder="https://your-instance.sisense.com"
              autoComplete="off"
              {...register('url')}
            />
            {errors.url && (
              <p className="text-sm text-destructive" role="alert">
                {errors.url.message}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="token">API token</Label>
            <Input
              id="token"
              type="text"
              autoComplete="off"
              spellCheck={false}
              {...register('token')}
            />
            {errors.token && (
              <p className="text-sm text-destructive" role="alert">
                {errors.token.message}
              </p>
            )}
          </div>
          <Button type="submit" disabled={isSubmitting}>
            Connect
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
