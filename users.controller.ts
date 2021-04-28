import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Op } from 'sequelize';

import { calculatePeriodQuery } from '../utils/calculatePeriodQuery';
import { JwtAuthGuard, RolesGuard } from '../guards';
import { CurrentUser, Roles } from '../decorators';
import { IdParamsDto } from '../shared/dto';
import { Role } from '../shared/enums';
import { forbiddenDepartment } from '../utils';
import { UsersService } from './users.service';
import { User } from './user.entity';
import {
  EditUserDto,
  QueryUserPeriodFilterDto,
  QueryUsersDto,
  UserDto,
  UsersByDepartmentsDto,
  UserStatisticDto,
  UserWithStatisticDto,
} from './dto';
import { AllUsersWithCompetenciesOptions } from './interfaces';

@Controller('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@ApiTags('users')
export class UsersController {
  constructor(
    private usersService: UsersService,
  ) {}

  @UseGuards(RolesGuard)
  @Get()
  @Roles(Role.admin, Role.techLead, Role.headOfDepartment, Role.manager)
  @ApiResponse({
    status: 200,
    description: 'Found records',
    type: UserDto,
    isArray: true,
  })
  async findUsers(
    @Query() query: QueryUsersDto, @CurrentUser() currentUser: User,
  ): Promise<UserDto[]> {
    const internalQuery = { ...query };

    if (currentUser.role === Role.manager) {
      internalQuery.departments = currentUser.departments.map(({ name }) => name);
    }

    const users = await this.usersService.findAll(internalQuery);

    return users.map((user) => new UserDto(user));
  }

  @UseGuards(RolesGuard)
  @Get('examiners')
  @Roles(Role.admin)
  @ApiResponse({
    status: 200,
    description: 'Found records',
    type: UserDto,
    isArray: true,
  })
  async getExaminers(): Promise<UserDto[]> {
    const users = await this.usersService.getExaminers();

    return users.map((user) => new UserDto(user));
  }

  @Get('me')
  async me(@CurrentUser() currentUser: User): Promise<UserDto> {
    return new UserDto(currentUser);
  }

  @UseGuards(RolesGuard)
  @Patch('congratulated')
  @Roles(Role.developer)
  async congratulated(@CurrentUser() currentUser: User) {
    return new UserDto(await currentUser.update({ needCongratulate: false }));
  }

  @UseGuards(RolesGuard)
  @Get('by-departments')
  @Roles(Role.admin, Role.techLead, Role.headOfDepartment, Role.manager)
  async findDevelopersByDepartments(
    @Query() query: QueryUsersDto, @CurrentUser() currentUser: User,
  ): Promise<UsersByDepartmentsDto> {
    const internalQuery = { ...query };
    if (currentUser.role === Role.manager) {
      internalQuery.departments = currentUser.departments.map(({ name }) => name);
    }
    const users = await this.usersService.findAll(internalQuery);

    return new UsersByDepartmentsDto(users);
  }

  @UseGuards(RolesGuard)
  @Get('statistic')
  @Roles(Role.admin, Role.techLead, Role.headOfDepartment, Role.manager)
  @ApiResponse({
    status: 200,
    description: 'Developers statistic for given period',
    type: UserWithStatisticDto,
    isArray: true,
  })
  async getStatisticForAllUsers(
    @Query() query: QueryUserPeriodFilterDto, @CurrentUser() currentUser: User,
  ): Promise<UserWithStatisticDto[]> {
    const { period } = query;
    const internalQuery: AllUsersWithCompetenciesOptions = {
      '$departments.UserDepartments.role$': Role.developer,
    };
    if (period != null) {
      internalQuery['$competencies.updatedAt$'] = { [Op.between]: calculatePeriodQuery[period]() };
    }
    if (currentUser.role === Role.manager) {
      internalQuery['$departments.name$'] = {
        [Op.in]: currentUser.departments.map(({ name }) => name),
      };
    }
    const users = await this.usersService.getAllUsersWithCompetencies(internalQuery);

    return users.map((user) => new UserWithStatisticDto(user));
  }

  @UseGuards(RolesGuard)
  @Get(':id')
  @Roles(Role.admin, Role.techLead, Role.headOfDepartment, Role.manager)
  @ApiResponse({
    status: 200,
    description: 'The found record',
    type: UserDto,
  })
  async findById(
    @Param() params: IdParamsDto, @CurrentUser() currentUser: User,
  ): Promise<UserDto> {
    const { id } = params;
    const user = await this.usersService.getUserById(id);

    if (user === null) throw new NotFoundException();
    if (forbiddenDepartment(currentUser, user)) throw new ForbiddenException();

    return new UserDto(user);
  }

  @UseGuards(RolesGuard)
  @Patch(':id')
  @Roles(Role.admin)
  async editById(@Param() params: IdParamsDto, @Body() body: EditUserDto) {
    const { id } = params;
    const user = await this.usersService.getUserById(id);

    if (user === null) throw new NotFoundException();

    const updatedUser = await user.update(body);
    return new UserDto(updatedUser);
  }

  @UseGuards(RolesGuard)
  @Get(':id/statistic')
  @Roles(Role.admin, Role.techLead, Role.headOfDepartment, Role.manager)
  @ApiResponse({
    status: 200,
    description: 'Developers statistic',
    type: UserStatisticDto,
  })
  async getStatisticForUser(
    @Param('id') userId: string, @CurrentUser() currentUser: User,
  ): Promise<UserStatisticDto> {
    const user = await this.usersService.getUserByIdWithCompetencies(userId);

    if (forbiddenDepartment(currentUser, user)) throw new ForbiddenException();
    if (user === null) throw new NotFoundException();

    return new UserStatisticDto(user);
  }
}
