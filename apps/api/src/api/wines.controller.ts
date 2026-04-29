import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { z } from 'zod';

import { WineService } from '../core/wine/wine.service';

const listQuerySchema = z.object({
  agency: z.string().optional(),
  color: z.string().optional(),
  country: z.string().optional(),
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

@Controller('wines')
export class WinesController {
  constructor(private readonly wines: WineService) {}

  @Get()
  async list(@Query() query: Record<string, string>) {
    const parsed = listQuerySchema.parse(query);
    return this.wines.list({
      ...(parsed.agency !== undefined && { agencyId: parsed.agency }),
      ...(parsed.color !== undefined && { color: parsed.color }),
      ...(parsed.country !== undefined && { country: parsed.country }),
      ...(parsed.q !== undefined && { q: parsed.q }),
      limit: parsed.limit,
      offset: parsed.offset,
    });
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const wine = await this.wines.get(id);
    if (!wine) throw new NotFoundException(`Wine ${id} not found`);
    return wine;
  }
}
