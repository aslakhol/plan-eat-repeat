import { type User } from "../../generated/prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { api } from "../utils/api";

type Props = {
  user: User;
};

export const UserAvatar = ({ user }: Props) => {
  return (
    <div className="flex items-center space-x-4">
      <AvatarCircle user={user} />
      <span>
        {user.firstName} {user.lastName}
      </span>
    </div>
  );
};

type BigUserAvatarProps = {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
  };
  householdId?: string;
};

export const BigUserAvatar = ({ user, householdId }: BigUserAvatarProps) => {
  const membersQuery = api.household.members.useQuery(
    {
      householdId: householdId ?? "",
    },
    {
      enabled: !!householdId,
    },
  );

  const role = membersQuery.data?.members.find(
    (m) => m.userId === user.id,
  )?.role;

  return (
    <div className="flex items-center space-x-4">
      <AvatarCircle user={user} />
      <div>
        <h3 className="text-lg font-semibold">
          {user.firstName} {user.lastName}
        </h3>
        <p className="text-sm capitalize text-muted-foreground">
          {role?.toLocaleLowerCase()}
        </p>
      </div>
    </div>
  );
};

type AvatarCircleProps = {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
  };
};

const AvatarCircle = ({ user }: AvatarCircleProps) => {
  const imageUrl =
    user.imageUrl && user.imageUrl !== "aslkdj"
      ? user.imageUrl
      : `https://api.dicebear.com/9.x/thumbs/svg?flip=true&backgroundColor=c0aede&seed=${user.id}`;

  return (
    <Avatar>
      <AvatarImage src={imageUrl} />
      <AvatarFallback>
        {user.firstName?.slice(0, 1)}
        {user.lastName?.slice(0, 1)}
      </AvatarFallback>
    </Avatar>
  );
};
