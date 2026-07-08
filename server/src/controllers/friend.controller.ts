// Empty controller for now
import { Request, Response } from "express";
import { User } from "../models/User";

export async function sendFriendRequest(req: Request, res: Response) {
  try {
    const senderId = (req as any).userId;
    const receiverId = req.params.userId;

    if (senderId === receiverId) {
      return res.status(400).json({
        error: "You cannot send a friend request to yourself",
      });
    }

    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    if (!sender || !receiver) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    if (sender.friends.includes(receiver._id as any)) {
      return res.status(400).json({
        error: "Already friends",
      });
    }

    if (sender.sentRequests.includes(receiver._id as any)) {
      return res.status(400).json({
        error: "Friend request already sent",
      });
    }

    sender.sentRequests.push(receiver._id);
    receiver.friendRequests.push(sender._id);

    await sender.save();
    await receiver.save();

    return res.json({
      message: "Friend request sent",
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Server error",
    });
  }
}

export async function listFriends(req: Request, res: Response) {
  try {
    const user = await User.findById((req as any).userId)
      .populate("friends", "username email avatar status");

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    return res.json(user.friends);

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Server error",
    });
  }
}
export async function listPendingRequests(req: Request, res: Response) {
  try {
    const user = await User.findById((req as any).userId)
      .populate("friendRequests", "username email avatar status");

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    return res.json(user.friendRequests);

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Server error",
    });
  }
}
export async function acceptRequest(req: Request, res: Response) {
  try {
    const receiverId = (req as any).userId;
    const senderId = req.params.userId;

    const receiver = await User.findById(receiverId);
    const sender = await User.findById(senderId);

    if (!receiver || !sender) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    receiver.friendRequests = receiver.friendRequests.filter(
      (id) => id.toString() !== senderId
    );

    sender.sentRequests = sender.sentRequests.filter(
      (id) => id.toString() !== receiverId
    );

    receiver.friends.push(sender._id);
    sender.friends.push(receiver._id);

    await receiver.save();
    await sender.save();

    return res.json({
      message: "Friend request accepted",
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Server error",
    });
  }
}
export async function rejectRequest(req: Request, res: Response) {}
export async function removeFriend(req: Request, res: Response) {}