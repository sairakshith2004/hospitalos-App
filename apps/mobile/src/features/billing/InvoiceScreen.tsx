import { invoiceSchema, receiptSchema } from '@hospitalos/contracts';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Banner,
  BottomSheet,
  DataRow,
  Divided,
  GlassCard,
  Icon,
  ListRow,
  PrimaryButton,
  QueryBoundary,
  ScreenContainer,
  ScreenHeader,
  SectionHeader,
  SegmentedControl,
  StatusChip,
  SurfaceCard,
  TextField,
  statusTone,
} from '@/components';
import { useSignedInSession } from '@/features/session/SessionProvider';
import { describeError } from '@/services/api/errors';
import { useApiMutation, useApiQuery } from '@/services/api/hooks';
import { formatPaise, hospitalTime, humanize } from '@/services/format';
import { colors, iconSize, layout, radius, spacing, tints } from '@/theme/tokens';

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

  const [receiptId, setReceiptId] = useState<string | null>(null);

  return (
    <ScreenContainer>
      <ScreenHeader title="Invoice" eyebrow="BILLING" back />
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
          const active = inv.lines.filter((l) => l.isActive);
          const sum = (type: string) =>
            active.filter((l) => l.sourceType === type).reduce((t, l) => t + l.lineTotalPaise, 0);
          const groups = [
            { type: 'consultation', label: 'Consultation charges' },
            { type: 'lab', label: 'Laboratory charges' },
            { type: 'dispensing', label: 'Medicine charges' },
            { type: 'manual', label: 'Other charges' },
          ].filter((g) => active.some((l) => l.sourceType === g.type));
          const balance = inv.totalPaise - inv.paidPaise;
          return (
            <View style={styles.root}>
              <GlassCard tone="hero" padding="lg" enterIndex={0}>
                <View style={styles.headRow}>
                  <View style={styles.headText}>
                    <AppText variant="overline" color="primary">
                      {inv.invoiceNo === null ? 'DRAFT INVOICE' : 'INVOICE'}
                    </AppText>
                    <AppText variant="title" numberOfLines={1}>
                      {inv.invoiceNo ?? 'Not issued yet'}
                    </AppText>
                    <AppText variant="bodySmall" color="textSecondary">
                      {`${inv.patient.name}  ·  ${inv.patient.mrn}`}
                    </AppText>
                  </View>
                  <StatusChip
                    label={humanize(inv.status)}
                    tone={statusTone(inv.status)}
                    size="md"
                  />
                </View>
                <View style={styles.totals}>
                  <DataRow label="Total" value={formatPaise(inv.totalPaise)} />
                  <DataRow label="Paid" value={formatPaise(inv.paidPaise)} valueColor="success" />
                  {inv.pendingCorrectionsPaise > 0 ? (
                    <DataRow
                      label="Pending correction"
                      value={formatPaise(inv.pendingCorrectionsPaise)}
                      valueColor="warning"
                    />
                  ) : null}
                  <DataRow
                    label={inv.status === 'draft' ? 'Draft total' : 'Outstanding'}
                    value={formatPaise(inv.status === 'draft' ? inv.totalPaise : balance)}
                    valueColor={balance > 0 ? 'text' : 'success'}
                    emphasis
                  />
                </View>
                {inv.pendingCorrectionsPaise > 0 ? (
                  <Banner
                    tone="warning"
                    title="Correction pending"
                    message={`${formatPaise(inv.pendingCorrectionsPaise)} for a cancelled service is waiting for Finance and can't be collected.`}
                  />
                ) : null}
              </GlassCard>

              <SectionHeader title="Charges" count={active.length} />
              <SurfaceCard padding="none" enterIndex={1}>
                <Divided>
                  {inv.lines.map((l) => (
                    <View key={l.id} style={styles.line} accessible>
                      <View style={styles.lineText}>
                        <AppText
                          variant="bodyStrong"
                          color={l.isActive ? 'text' : 'textMuted'}
                          style={!l.isActive && styles.struck}
                        >
                          {l.description}
                        </AppText>
                        <AppText variant="caption" color="textMuted">
                          {`${l.qty} × ${formatPaise(l.unitPricePaise)}${l.isActive ? '' : `  ·  removed: ${l.deactivationReason ?? ''}`}`}
                        </AppText>
                      </View>
                      <AppText
                        variant="figure"
                        color={l.isActive ? 'text' : 'textMuted'}
                        style={!l.isActive && styles.struck}
                      >
                        {formatPaise(l.lineTotalPaise)}
                      </AppText>
                    </View>
                  ))}
                </Divided>
              </SurfaceCard>
              {groups.length > 0 ? (
                <SurfaceCard padding="md">
                  {groups.map((g) => (
                    <DataRow key={g.type} label={g.label} value={formatPaise(sum(g.type))} />
                  ))}
                  <DataRow label="Total" value={formatPaise(inv.totalPaise)} emphasis />
                </SurfaceCard>
              ) : null}

              {inv.status === 'draft' && can('invoice:issue') ? (
                <PrimaryButton
                  label="Issue invoice"
                  fullWidth
                  size="lg"
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
                <>
                  <SectionHeader title="Collect payment" />
                  <SurfaceCard padding="lg">
                    <DataRow
                      label="Collectable now"
                      value={formatPaise(inv.collectablePaise)}
                      valueColor="primary"
                    />
                    <TextField
                      label="Amount (₹)"
                      keyboardType="decimal-pad"
                      value={amount}
                      onChangeText={setAmount}
                      helperText="Part payments are allowed, up to the collectable amount."
                      errorText={
                        paise > inv.collectablePaise
                          ? `More than the collectable ${formatPaise(inv.collectablePaise)}.`
                          : undefined
                      }
                    />
                    <SegmentedControl
                      label="Payment method"
                      value={method}
                      onChange={setMethod}
                      options={METHODS.map((m) => ({ value: m, label: m.toUpperCase() }))}
                    />
                    <PrimaryButton
                      label={paise > 0 ? `Record ${formatPaise(paise)}` : 'Enter an amount'}
                      fullWidth
                      size="lg"
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
                </>
              ) : null}

              {inv.payments.length > 0 ? (
                <>
                  <SectionHeader title="Receipts" count={inv.payments.length} />
                  <SurfaceCard padding="none">
                    <Divided>
                      {inv.payments.map((p) => (
                        <ListRow
                          key={p.id}
                          title={p.receiptNo}
                          subtitle={`${p.method.toUpperCase()}  ·  ${hospitalTime(p.receivedAt)}`}
                          leading={
                            <View style={styles.receiptWell}>
                              <Icon name="receipt" size={iconSize.sm} color={colors.success} />
                            </View>
                          }
                          trailing={
                            <AppText variant="figure">{formatPaise(p.amountPaise)}</AppText>
                          }
                          onPress={() => setReceiptId(p.id)}
                          accessibilityHint="Opens the receipt"
                        />
                      ))}
                    </Divided>
                  </SurfaceCard>
                </>
              ) : null}
            </View>
          );
        }}
      </QueryBoundary>
      <ReceiptSheet paymentId={receiptId} onClose={() => setReceiptId(null)} />
    </ScreenContainer>
  );
}

/** A receipt as issued, from GET /api/v1/payments/:id/receipt (balance as at that payment). */
function ReceiptSheet({ paymentId, onClose }: { paymentId: string | null; onClose: () => void }) {
  const receipt = useApiQuery(
    ['receipt', paymentId],
    paymentId === null ? null : `/api/v1/payments/${paymentId}/receipt`,
    receiptSchema,
  );
  return (
    <BottomSheet visible={paymentId !== null} title="Receipt" onClose={onClose}>
      <QueryBoundary query={receipt} loadingLabel="Loading receipt">
        {(r) => (
          <View style={styles.receipt}>
            <View style={styles.receiptHead}>
              <View style={styles.receiptIcon}>
                <Icon name="check" size={iconSize.lg} color={colors.success} />
              </View>
              <AppText variant="figureLarge">{formatPaise(r.amountPaise)}</AppText>
              <AppText variant="bodySmall" color="textMuted">
                {`Received by ${r.method.toUpperCase()}`}
              </AppText>
            </View>
            <DataRow label="Receipt" value={r.receiptNo} />
            <DataRow label="Invoice" value={r.invoiceNo} />
            <DataRow label="Patient" value={`${r.patient.name} (${r.patient.mrn})`} />
            <DataRow label="Received at" value={hospitalTime(r.receivedAt)} />
            <DataRow
              label="Balance after this payment"
              value={formatPaise(r.balancePaise)}
              emphasis
            />
          </View>
        )}
      </QueryBoundary>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  headRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headText: { flex: 1, gap: spacing.xxs },
  totals: { gap: spacing.xxs },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  lineText: { flex: 1, gap: spacing.xxs },
  struck: { textDecorationLine: 'line-through' },
  receiptWell: {
    width: layout.iconWell,
    height: layout.iconWell,
    borderRadius: radius.sm,
    backgroundColor: tints.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receipt: { gap: spacing.xs },
  receiptHead: { alignItems: 'center', gap: spacing.xs, paddingBottom: spacing.md },
  receiptIcon: {
    width: layout.stateWell,
    height: layout.stateWell,
    borderRadius: radius.pill,
    backgroundColor: tints.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
