import cs from './admin/cs.json';
import en from './admin/en.json';
import ru from './admin/ru.json';
import uk from './admin/uk.json';
import { DICT } from '../i18n';

/**
 * The staff app's texts (adm.*, vch.*, ln.*) live ONLY in the admin chunk: this module is imported by admin/admin.tsx, so clients never download them.
 * Importing it registers the four languages into the shared dictionary.
 */
Object.assign(DICT.cs, cs); Object.assign(DICT.en, en); Object.assign(DICT.ru, ru); Object.assign(DICT.uk, uk);
