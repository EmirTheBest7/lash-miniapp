import { useState } from 'preact/hooks';
import { Avatar, Button, Cell, Chip, Empty, Section, Segmented, Sheet, Skeleton, Switch, Toast } from '../ui/components';

/** Dev / e2e only: every component in one page, for visual review in light/dark x ios/android/desktop. Synthetic text. */
export function Gallery() {
  const [seg, setSeg] = useState<'day' | 'week' | 'month'>('week');
  const [on, setOn] = useState(true);
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState('10:30');
  return (
    <div class="page" data-testid="gallery">
      <h1 class="large">Components</h1>
      <Segmented options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} value={seg} onChange={setSeg} />
      <Section title="Cells" footer="Grouped list, separators inset, chevrons.">
        <Cell icon="calendar" title="Book an appointment" subtitle="Pick a service, day and time" chevron onClick={() => {}} />
        <Cell icon="user" title="Anna Nováková" subtitle="@anna_n · +420 777 000 111" after="Client" />
        <Cell title="Selected" selected after="✓" />
        <Cell title="Delete booking" destructive onClick={() => {}} />
        <Cell title="Notifications" after={<Switch checked={on} onChange={setOn} label="Notifications" />} />
      </Section>
      <Section title="Day strip">
        <div class="chips strip">
          <Chip label="Tue 18" sub="today" selected /><Chip label="Wed 19" /><Chip label="Thu 20" struck /><Chip label="Fri 21" /><Chip label="Sat 22" disabled /><Chip label="Sun 23" disabled />
        </div>
      </Section>
      <Section title="Times">
        <div class="chips">{['10:00', '10:30', '11:00', '11:30', '13:00', '14:30'].map((s) => <Chip label={s} selected={s === slot} onClick={() => setSlot(s)} />)}</div>
      </Section>
      <Section title="People"><Cell title="Eva Svobodová" subtitle="Fill · 14:00" after={<Avatar name="Eva Svobodová" />} /></Section>
      <Section title="Loading"><Skeleton lines={3} /></Section>
      <Section title="Empty"><Empty title="No appointments" text="Your bookings will show up here." icon="calendar" /></Section>
      <Button onClick={() => setOpen(true)}>Open sheet</Button>
      <Button secondary onClick={() => {}}>Secondary</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Appointment">
        <Section><Cell title="Eva Svobodová" subtitle="Lash fill · 14:00–15:15" after={<Avatar name="Eva Svobodová" />} /><Cell title="Confirm" chevron onClick={() => setOpen(false)} /><Cell title="Cancel booking" destructive onClick={() => setOpen(false)} /></Section>
      </Sheet>
      <Toast text={null} />
    </div>
  );
}
