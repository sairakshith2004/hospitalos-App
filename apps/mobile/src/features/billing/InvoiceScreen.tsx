import { invoiceSchema, receiptSchema } from '@hospitalos/contracts';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  ListRow,
  PrimaryButton,
  QueryBoundary,
  ScreenContainer,
  ScreenHeader,
  SecondaryButton,
  SectionHeader,
  StatusChip,
  SurfaceCard,
  TextField,
} from '@/components';
import { useSignedInSession } from '@/features/session/SessionProvider';
import { describeError } from '@/services/api/errors';
import { useApiMutation, useApiQuery } from '@/services/api/hooks';
import { formatPaise, humanize } from '@/services/format';
import { spacing } from '@/theme/tokens';

const METHODS = ['cash', 'card', 'upi', 'bank'] as const;

/** Invoice, payments and receipts (viewed in the app only; no export or sharing in R1). */
export function InvoiceScreen({ id }: { id: string }) {
  const session = useSignedInSession();
  const can = (p: string) => session.permissions.some((x) => x === p);
  const invoice = useApiQuery(['invoice', id], `/api/v1/invoices/${id}`, invoiceSchema);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('cash');
  const [message, setMessage] = useState<{
    tone: 'success' | 'danger';
    title: string;
    text: string;
  } | null>(null);
  const invalidate = [['invoice', id], ['invoices'], ['dashboard']] as const;
  const issue = useApiMutation(
    () => ({ path: `/api/v1/invoices/${id}/issue` }),
    invoiceSchema,
    invalidate,
  );
  const pay = useApiMutation(
    (body: unknown) => ({ path: `/api/v1/invoices/${id}/payments`, body, idempotent: true }),
    receiptSchema,
    invalidate,
  );

  return (
    <ScreenContainer>
      <ScreenHeader title="Invoice" back />
      {message !== null ? (
        <Banner tone={message.tone} title={message.title} message={message.text} />
      ) : null}
      <QueryBoundary query={invoice} loadingLabel="Loading invoice">
        {(inv) => {
          // Rupees typed by a person become integer paise without floating-point arithmetic.
          const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
          const paise = match
            ? Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
            : 0;
          return (
            <View style={styles.root}>
              <SurfaceCard>
                <AppText variant="headline">{inv.invoiceNo ?? 'Draft invoice'}</AppText>
                <AppText color="textSecondary">{`${inv.patient.name} · ${inv.patient.mrn}`}</AppText>
                <StatusChip label={humanize(inv.status)} tone="primary" />
                <AppText>{`Total ${formatPaise(inv.totalPaise)} · paid ${formatPaise(inv.paidPaise)}`}</AppText>
                {inv.pendingCorrectionsPaise > 0 ? (
                  <Banner
                    tone="warning"
                    title="Correction pending"
                    message={`${formatPaise(inv.pendingCorrectionsPaise)} for a cancelled service is waiting for Finance and can't be collected.`}
                  />
                ) : null}
              </SurfaceCard>

              <SectionHeader title="Charges" />
              <SurfaceCard padding="none">
                {inv.lines.map((l) => (
                  <ListRow
                    key={l.id}
                    title={l.description}
                    subtitle={`${l.qty} × ${formatPaise(l.unitPricePaise)}${l.isActive ? '' : ` · removed: ${l.deactivationReason ?? ''}`}`}
                    trailing={
                      <AppText color={l.isActive ? 'text' : 'textMuted'}>
                        {formatPaise(l.lineTotalPaise)}
                      </AppText>
                    }
                  />
                ))}
              </SurfaceCard>

              {inv.status === 'draft' && can('invoice:issue') ? (
                <PrimaryButton
                  label="Issue invoice"
                  fullWidth
                  loading={issue.isPending}
                  onPress={() =>
                    void issue
                      .mutateAsync(undefined)
                      .then((i) =>
                        setMessage({
                          tone: 'success',
                          title: 'Issued',
                          text: `${i.invoiceNo ?? ''} can no longer change.`,
                        }),
                      )
                      .catch((e: unknown) =>
                        setMessage({ tone: 'danger', title: 'Not issued', text: describeError(e) }),
                      )
                  }
                />
              ) : null}

              {(inv.status === 'issued' || inv.status === 'partially_paid') &&
              can('payment:record') ? (
                <SurfaceCard>
                  <AppText variant="label">{`Collect up to ${formatPaise(inv.collectablePaise)}`}</AppText>
                  <TextField
                    label="Amount (₹)"
                    keyboardType="decimal-pad"
                    value={amount}
                    onChangeText={setAmount}
                  />
                  <View style={styles.wrap}>
                    {METHODS.map((m) => (
                      <SecondaryButton
                        key={m}
                        label={m.toUpperCase()}
                        disabled={method === m}
                        onPress={() => setMethod(m)}
                      />
                    ))}
                  </View>
                  <PrimaryButton
                    label={paise > 0 ? `Record ${formatPaise(paise)}` : 'Enter an amount'}
                    fullWidth
                    disabled={paise <= 0 || paise > inv.collectablePaise}
                    loading={pay.isPending}
                    onPress={() =>
                      void pay
                        .mutateAsync({ amountPaise: paise, method })
                        .then((r) => {
                          setAmount('');
                          setMessage({
                            tone: 'success',
                            title: `Receipt ${r.receiptNo}`,
                            text: `${formatPaise(r.amountPaise)} by ${r.method.toUpperCase()}. Balance ${formatPaise(r.balancePaise)}.`,
                          });
                        })
                        .catch((e: unknown) =>
                          setMessage({
                            tone: 'danger',
                            title: 'Not recorded',
                            text: describeError(e),
                          }),
                        )
                    }
                  />
                </SurfaceCard>
              ) : null}

              {inv.payments.length > 0 ? <SectionHeader title="Receipts" /> : null}
              {inv.payments.length > 0 ? (
                <SurfaceCard padding="none">
                  {inv.payments.map((p) => (
                    <ListRow
                      key={p.id}
                      title={p.receiptNo}
                      subtitle={p.method.toUpperCase()}
                      trailing={<AppText>{formatPaise(p.amountPaise)}</AppText>}
                    />
                  ))}
                </SurfaceCard>
              ) : null}
            </View>
          );
        }}
      </QueryBoundary>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
