import { Module } from '@nestjs/common';

/**
 * Empty barrel module retained for symmetry. Agency modules don't need anything
 * from here — discovery happens via the @Agency() decorator + DiscoveryService.
 * Keeping this file so future cross-cutting agency concerns (rate limiting,
 * shared retry policy, etc.) have an obvious home.
 */
@Module({})
export class AgencyContractModule {}
