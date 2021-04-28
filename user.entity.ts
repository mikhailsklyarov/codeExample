import {
  BelongsToMany,
  Column,
  DataType,
  HasMany,
  Model,
  Scopes,
  Sequelize,
  Table,
  BeforeUpdate,
} from 'sequelize-typescript';

import { UserCompetence } from '../competence/userCompetence.entity';
import { UserDepartments } from '../departments/user_departments.entity';
import { Level, levels, Role } from '../shared/enums';
import { Department, DepartmentWithUserDepartment } from '../departments/department.entity';
import { UserScopes } from './interfaces';
import { UserUnavailability } from '../user-unavailability/user-unavailability.entity';

@Scopes({
  [UserScopes.withLastDatetimePass]() {
    return {
      attributes: { include: [[Sequelize.fn('max', Sequelize.col('competencies.updatedAt')), 'lastDatetimePass']] },
      include: [{ model: UserCompetence, attributes: [] }],
      group: ['User.id'],
    };
  },
  [UserScopes.mainScope]() {
    return ({ where: { blocked: false } });
  },
  [UserScopes.withRole]() {
    return ({
      attributes: { include: [[Sequelize.fn('min', Sequelize.col('departments.UserDepartments.role')), 'role']] },
      include: [{
        model: Department,
      }],
      group: ['User.id', 'departments.UserDepartments.id', 'departments.id'],
    });
  },
})
@Table({
  tableName: 'users',
})
export class User extends Model<User> {
  @Column({
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
    type: DataType.UUID,
  })
  public id: string;

  @Column
  public firstName: string;

  @Column
  public lastName: string;

  @Column({
    type: DataType.TEXT,
  })
  public avatarUrl: string;

  @Column({
    type: DataType.ENUM(...levels),
    defaultValue: 'TRAINEE',
  })
  public level: Level;

  @Column
  public email: string;

  @Column({
    defaultValue: false,
  })
  public blocked: boolean;

  @Column({
    defaultValue: false,
  })
  public needCongratulate: boolean;

  @BelongsToMany(() => Department, () => UserDepartments)
  departments: DepartmentWithUserDepartment[];

  @HasMany(() => UserCompetence)
  competencies: UserCompetence[];

  @HasMany(() => UserUnavailability)
  unavailability: UserUnavailability[];

  @BeforeUpdate
  static beforeUpdateLevel(instance: User, options: any) {
    if (options.fields.includes('level')) {
      instance.needCongratulate = true;
    }
  }

  lastDatetimePass: Date;

  get role(): Role {
    return this.getDataValue('role');
  }
}
