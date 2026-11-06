import {
  createStaffRequestSchema,
  ROLE_CODES,
  ROLE_NAMES,
  staffListSchema,
  staffSummarySchema,
  type StaffSummary,
} from '@hospitalos/contracts';
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
import {
  schemaFieldErrors,
  serverFieldErrors,
  type FieldMessages,
} from '@/services/api/form-errors';
import { useApiMutation, useApiQuery } from '@/services/api/hooks';
import { spacing } from '@/theme/tokens';

/**
 * Minimal staff-account administration (phase 1.2b): HR adds a login with a temporary password
 * (changed at first sign-in); a Super Admin grants and revokes roles; an administrator disables or
 * re-enables accounts. Every change needs a reason and is audited by the server.
 */
export function StaffAdminScreen() {
  const session = useSignedInSession();
  const can = (p: string) => session.permissions.some((x) => x === p);
  const staff = useApiQuery(['staff'], '/api/v1/admin/staff', staffListSchema);
  const [selected, setSelected] = useState<StaffSummary | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    employeeNo: '',
    departmentCode: 'ADMIN',
    designation: '',
    username: '',
    email: '',
    temporaryPassword: '',
  });
  const [fields, setFields] = useState<FieldMessages>({});
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const create = useApiMutation(
    (body: unknown) => ({ path: '/api/v1/admin/staff', body }),
    staffSummarySchema,
    [['staff']],
  );
  const role = useApiMutation(
    (b: { id: string; action: 'grant' | 'revoke'; role: string }) => ({
      path: `/api/v1/admin/users/${b.id}/roles/${b.action}`,
      body: { role: b.role, reason },
    }),
    staffSummarySchema,
    [['staff']],
  );
  const status = useApiMutation(
    (b: { id: string; status: 'active' | 'disabled' }) => ({
      path: `/api/v1/admin/users/${b.id}/status`,
      body: { status: b.status, reason },
    }),
    staffSummarySchema,
    [['staff']],
  );
  const done = (s: StaffSummary) => {
    setSelected(s);
    setReason('');
    setMessage({ tone: 'success', text: 'Saved and recorded in the audit log.' });
  };
  const fail = (e: unknown) => setMessage({ tone: 'danger', text: describeError(e) });
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <ScreenContainer>
      <ScreenHeader title="Staff accounts" back />
      {message !== null ? (
        <Banner
          tone={message.tone}
          title={message.tone === 'success' ? 'Done' : 'Not done'}
          message={message.text}
        />
      ) : null}

      {can('user:create') ? (
        <>
          <SectionHeader title="Add staff member" />
          <SurfaceCard>
            {(
              [
                ['fullName', 'Full name'],
                ['employeeNo', 'Employee number'],
                ['departmentCode', 'Department code'],
                ['designation', 'Designation'],
                ['username', 'Username'],
                ['email', 'Work email (optional)'],
                ['temporaryPassword', 'Temporary password (12+ characters)'],
              ] as const
            ).map(([key, label]) => (
              <TextField
                key={key}
                label={label}
                value={form[key]}
                onChangeText={set(key)}
                autoCapitalize={key === 'fullName' || key === 'designation' ? 'words' : 'none'}
                secureTextEntry={key === 'temporaryPassword'}
                errorText={fields[key]}
              />
            ))}
            <PrimaryButton
              label="Create login"
              fullWidth
              loading={create.isPending}
              onPress={() => {
                const parsed = createStaffRequestSchema.safeParse({
                  ...form,
                  email: form.email.trim() || undefined,
                });
                setFields(schemaFieldErrors(parsed));
                if (!parsed.success) return;
                void create
                  .mutateAsync(parsed.data)
                  .then((s) => {
                    setForm({
                      fullName: '',
                      employeeNo: '',
                      departmentCode: 'ADMIN',
                      designation: '',
                      username: '',
                      email: '',
                      temporaryPassword: '',
                    });
                    done(s);
                  })
                  .catch((e: unknown) => {
                    setFields(serverFieldErrors(e));
                    fail(e);
                  });
              }}
            />
            <AppText variant="caption" color="textSecondary">
              The new account has no roles and must choose its own password at first sign-in.
            </AppText>
          </SurfaceCard>
        </>
      ) : null}

      {selected !== null ? (
        <SurfaceCard>
          <AppText variant="headline">{selected.fullName}</AppText>
          <AppText color="textSecondary">{`${selected.username} · ${selected.employeeNo} · ${selected.status}`}</AppText>
          <TextField
            label="Reason (required for every change)"
            value={reason}
            onChangeText={setReason}
          />
          {can('user_role:assign') ? (
            <View style={styles.wrap}>
              {ROLE_CODES.map((code) => {
                const has = selected.roles.includes(code);
                return (
                  <SecondaryButton
                    key={code}
                    label={`${has ? '✓ ' : '+ '}${ROLE_NAMES[code]}`}
                    disabled={reason.trim().length < 3}
                    onPress={() =>
                      void role
                        .mutateAsync({
                          id: selected.id,
                          action: has ? 'revoke' : 'grant',
                          role: code,
                        })
                        .then(done)
                        .catch(fail)
                    }
                  />
                );
              })}
            </View>
          ) : null}
          {can('user:manage') ? (
            <PrimaryButton
              label={selected.status === 'active' ? 'Disable account' : 'Re-enable account'}
              disabled={reason.trim().length < 3}
              loading={status.isPending}
              onPress={() =>
                void status
                  .mutateAsync({
                    id: selected.id,
                    status: selected.status === 'active' ? 'disabled' : 'active',
                  })
                  .then(done)
                  .catch(fail)
              }
            />
          ) : null}
        </SurfaceCard>
      ) : null}

      <SectionHeader title="Staff" />
      <QueryBoundary query={staff} loadingLabel="Loading staff">
        {(list) => (
          <SurfaceCard padding="none">
            {list.items.map((s) => (
              <ListRow
                key={s.id}
                title={s.fullName}
                subtitle={`${s.username} · ${s.roles.join(', ') || 'no roles'}${s.mustChangePassword ? ' · must change password' : ''}`}
                trailing={
                  <StatusChip
                    label={s.status}
                    tone={s.status === 'active' ? 'success' : 'danger'}
                  />
                }
                onPress={() => {
                  setSelected(s);
                  setMessage(null);
                }}
              />
            ))}
          </SurfaceCard>
        )}
      </QueryBoundary>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
