import { BadRequestException, Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsInt, IsObject, IsOptional, IsUUID, Max, Min } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthContext } from "../auth/jwt.strategy";
import { GameService } from "./game.service";
import { avatarSchema } from "./avatar";

class PlayerDto {
  @IsOptional() @IsUUID() memberId?: string;
}

class AvatarDto extends PlayerDto {
  @IsObject() avatar!: Record<string, unknown>;
}

class StartMemoryDto extends PlayerDto {
  @IsInt() @Min(1) @Max(3) level!: number;
}

class FinishMemoryDto extends PlayerDto {
  @IsArray() @ArrayMaxSize(400) @IsInt({ each: true }) flips!: number[];
}

@ApiTags("game")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("game")
export class GameController {
  constructor(private readonly game: GameService) {}

  @Get("state")
  async state(
    @CurrentUser() user: AuthContext,
    @Query("familyId") familyId?: string,
    @Query("memberId") memberId?: string,
  ) {
    const member = await this.game.resolvePlayer(user, familyId, memberId);
    return this.game.getState(member);
  }

  @Put("avatar")
  async avatar(@CurrentUser() user: AuthContext, @Query("familyId") familyId: string | undefined, @Body() dto: AvatarDto) {
    const parsed = avatarSchema.safeParse(dto.avatar);
    if (!parsed.success) throw new BadRequestException("invalid_avatar");
    const member = await this.game.resolvePlayer(user, familyId, dto.memberId);
    return this.game.setAvatar(member, parsed.data);
  }

  @Post("quests/:key/accept")
  async accept(
    @CurrentUser() user: AuthContext,
    @Query("familyId") familyId: string | undefined,
    @Param("key") key: string,
    @Body() dto: PlayerDto,
  ) {
    const member = await this.game.resolvePlayer(user, familyId, dto.memberId);
    return this.game.acceptQuest(member, key);
  }

  @Post("quests/:key/cancel")
  async cancel(
    @CurrentUser() user: AuthContext,
    @Query("familyId") familyId: string | undefined,
    @Param("key") key: string,
    @Body() dto: PlayerDto,
  ) {
    const member = await this.game.resolvePlayer(user, familyId, dto.memberId);
    return this.game.cancelQuest(member, key);
  }

  @Post("quests/:key/claim")
  async claim(
    @CurrentUser() user: AuthContext,
    @Query("familyId") familyId: string | undefined,
    @Param("key") key: string,
    @Body() dto: PlayerDto,
  ) {
    const member = await this.game.resolvePlayer(user, familyId, dto.memberId);
    return this.game.claimQuest(member, key);
  }

  @Post("daily-chest/claim")
  async dailyChest(@CurrentUser() user: AuthContext, @Query("familyId") familyId: string | undefined, @Body() dto: PlayerDto) {
    const member = await this.game.resolvePlayer(user, familyId, dto.memberId);
    return this.game.claimDailyChest(member);
  }

  @Post("minigames/memory/start")
  async startMemory(
    @CurrentUser() user: AuthContext,
    @Query("familyId") familyId: string | undefined,
    @Body() dto: StartMemoryDto,
  ) {
    const member = await this.game.resolvePlayer(user, familyId, dto.memberId);
    return this.game.startMemory(member, dto.level);
  }

  @Post("minigames/memory/:sessionId/finish")
  async finishMemory(
    @CurrentUser() user: AuthContext,
    @Query("familyId") familyId: string | undefined,
    @Param("sessionId") sessionId: string,
    @Body() dto: FinishMemoryDto,
  ) {
    const member = await this.game.resolvePlayer(user, familyId, dto.memberId);
    return this.game.finishMemory(member, sessionId, dto.flips);
  }
}
