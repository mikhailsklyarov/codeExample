import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  col, FindOptions, fn, literal, Op,
} from 'sequelize';

import { UserCompetence } from '../competence/userCompetence.entity';
import { Competence } from '../competence/competence.entity';
import { Specialization } from '../specializations/specialization.entity';
import { withMainScope } from '../utils';
import { User } from './user.entity';
import { AllUsersWithCompetenciesOptions, UserScopes } from './interfaces';
import { QueryUsersDto } from './dto';
import { Level, levels, Role } from '../shared/enums';
import { Department } from '../departments/department.entity';

@Injectable()
export class UsersService {
  constructor(
    @Inject('USERS_REPOSITORY')
    private readonly usersRepository: typeof User,
  ) {}

  async getUserById(id: string): Promise<User> {
    return this.usersRepository
      .scope(withMainScope(UserScopes.withLastDatetimePass))
      .findByPk<User>(id);
  }

  async getUserByIdWithCompetencies(id: string): Promise<User> {
    return this.usersRepository.scope(UserScopes.withRole).findByPk<User>(id, {
      include: [{
        model: UserCompetence,
        include: [{
          model: Competence,
          include: [{
            model: Specialization,
          }],
        }],
      }],
      group: ['competencies.id', 'competencies->competence.id', 'competencies->competence->specialization.id'],
    });
  }

  async getAllUsersWithCompetencies(options: AllUsersWithCompetenciesOptions) {
    const queryOptions: FindOptions = {
      where: {
        ...options,
      },
      attributes: {
        include: [[fn('COUNT', col('competencies.userId')), 'competencies.count']],
      },
      order: [
        ['level', 'ASC'],
        ['lastName', 'ASC'],
        ['firstName', 'ASC'],
        [{ model: Department, as: 'departments' }, 'name', 'ASC'],
      ],
      include: [{
        model: UserCompetence,
        include: [{
          model: Competence,
          include: [{
            model: Specialization,
          }],
        }],
      }],
      having: literal('competencies.count > 0'),
      group: ['User.id', 'competencies.id', 'competencies->competence.id', 'competencies->competence->specialization.id'],
    };

    return this.usersRepository.scope(withMainScope()).findAll(queryOptions);
  }

  async findOrCreate(email: string): Promise<[User, boolean]> {
    return this.usersRepository.unscoped().findOrCreate({
      where: {
        email,
      },
    });
  }

  async findAll(options: QueryUsersDto) {
    const {
      search,
      departments,
      role,
      ...filter
    } = options;
    const queryOptions: FindOptions = {
      where: { ...filter },
      order: [
        [{ model: Department, as: 'departments' }, 'name', 'ASC'],
        ['level', 'ASC'],
        ['lastName', 'ASC'],
        ['firstName', 'ASC'],
      ],
    };

    if (search != null) {
      queryOptions.where[Op.or] = [
        {
          firstName: {
            [Op.iLike]: `%${search}%`,
          },
        },
        {
          lastName: {
            [Op.iLike]: `%${search}%`,
          },
        },
      ];
    }
    if (departments != null) {
      queryOptions.where['$departments.name$'] = {
        [Op.in]: departments,
      };
    }

    if (role != null) {
      queryOptions.where['$departments.UserDepartments.role$'] = role;
    }

    return this.usersRepository
      .scope(withMainScope(UserScopes.withLastDatetimePass))
      .findAll(queryOptions);
  }

  async getExaminers(): Promise<User[]> {
    return this.usersRepository
      .scope(withMainScope())
      .findAll({
        where: {
          '$departments.UserDepartments.role$': {
            [Op.in]: [Role.admin, Role.techLead, Role.headOfDepartment],
          },
        },
      });
  }

  async levelUp(id: string, currentLevel: Level): Promise<User> {
    const user = await this.usersRepository.findByPk(id);
    if (user != null) {
      const currentLevelIndex = levels.indexOf(currentLevel);
      const level = levels[currentLevelIndex + 1] || levels.slice(-1);
      return user.update({
        level,
      });
    }
    throw new NotFoundException();
  }
}
