import { SetMetadata } from '@nestjs/common';

/** Metadata key used by AggregatorService.discover() to find AgencyAdapter providers. */
export const AGENCY_METADATA = 'wine:agency-adapter';

/**
 * Class decorator that marks a provider as an AgencyAdapter for auto-discovery.
 * Combine with `@Injectable()`:
 *
 *   @Injectable()
 *   @Agency()
 *   export class SaqAdapter extends RestAdapterBase<...> { ... }
 */
export const Agency = (): ClassDecorator => SetMetadata(AGENCY_METADATA, true);
