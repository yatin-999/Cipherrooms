import { Router } from "express";
import {
  listFriends,
  listPendingRequests,
  sendFriendRequest,
  acceptRequest,
  rejectRequest,
  removeFriend,
} from "../controllers/friend.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.use(requireAuth);

router.get("/", listFriends);
router.get("/requests", listPendingRequests);
router.post("/request/:userId", sendFriendRequest);
router.post("/accept/:userId", acceptRequest);
router.post("/reject/:userId", rejectRequest);
router.delete("/:userId", removeFriend);

export default router;