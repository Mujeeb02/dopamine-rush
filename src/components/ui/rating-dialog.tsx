import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";

interface RatingDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (rating: number, review: string) => Promise<void> | void;
  gameName: string;
}

const RatingDialog = ({ open, onClose, onSubmit, gameName }: RatingDialogProps) => {
  const [rating, setRating] = useState<number>(0);
  const [hover, setHover] = useState<number>(0);
  const [review, setReview] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!rating) return;
    setError('');
    try {
      setSubmitting(true);
      await onSubmit(rating, review.trim());
      setRating(0);
      setHover(0);
      setReview("");
      onClose();
    } catch {
      setError('Your review could not be saved. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-gray-900 text-white border-white/10">
        <DialogHeader>
          <DialogTitle>Rate your game</DialogTitle>
          <DialogDescription className="text-gray-400">
            How was your experience with {gameName}? Your feedback helps improve the game.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 my-2 justify-center">
          {[1,2,3,4,5].map((star) => (
            <button
              key={star}
              type="button"
              className="p-2 min-h-11 min-w-11"
              aria-label={`Rate ${star} out of 5`}
              aria-pressed={rating === star}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(star)}
            >
              <Star className={(hover || rating) >= star ? "text-yellow-400 fill-yellow-400" : "text-gray-500"} />
            </button>
          ))}
        </div>

        <Textarea
          aria-label="Your review (optional)"
          placeholder="Leave an optional review (max 500 chars)"
          value={review}
          onChange={(e) => setReview(e.target.value.slice(0, 500))}
          className="bg-white/5 border-white/10 text-white"
        />
        {error && <p role="alert" className="error-text">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Skip</Button>
          <Button onClick={handleSubmit} disabled={!rating || submitting} className="bg-yellow-500 hover:bg-yellow-600 text-black">
            {submitting ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RatingDialog;


