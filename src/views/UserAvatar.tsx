import { type User } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";

type Props = {
  user: User;
};

export const UserAvatar = ({ user }: Props) => {
  const imageUrl =
    user.imageUrl && user.imageUrl !== "aslkdj"
      ? user.imageUrl
      : `https://api.dicebear.com/9.x/thumbs/svg?flip=true&backgroundColor=c0aede&seed=${user.id}`;

  return (
    <div className="flex items-center space-x-4">
      <Avatar>
        <AvatarImage src={imageUrl} />
        <AvatarFallback>
          {user.firstName?.slice(0, 1)}
          {user.lastName?.slice(0, 1)}
        </AvatarFallback>
      </Avatar>
      <span>
        {user.firstName} {user.lastName}
      </span>
    </div>
  );
};
